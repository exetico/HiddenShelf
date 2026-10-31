#!/usr/bin/env bash
# Hidden Shelf host updater.
#
# Runs on the host (never in the app container), started by systemd when
# the app drops a request in control/inbox/, and hourly to check for new
# commits. It only ever does a fixed job:
#
#   update    fast-forward to origin/main, build while the old version keeps
#             serving, back up the database, swap, health-check, and roll
#             back by itself if the new version is unhealthy
#   rollback  go back one step to the version before the last update
#   check     fetch and list the commits that an update would bring in
#
# What the app can influence is a 32-character request id in
# control/inbox/request. The action and the commit come from the app's
# database row for that id (read only), and the commit must equal what is
# on origin/main right now. No value from the app is ever run as a command.
#
# Usage: hiddenshelf-updater.sh run|check|watch
#
# Everything is inside functions and the last line calls main, so a git
# pull that rewrites this file mid-run can't change what runs.

set -uo pipefail

REPO_DIR="${HIDDENSHELF_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BRANCH="${UPDATER_BRANCH:-main}"
IMAGE="hiddenshelf"
CONTROL="$REPO_DIR/control"
INBOX="$CONTROL/inbox"
STATUS="$CONTROL/status"
STATE="$CONTROL/state"
HEALTH_TIMEOUT="${UPDATER_HEALTH_TIMEOUT:-60}"
HEALTH_INTERVAL="${UPDATER_HEALTH_INTERVAL:-2}"
REQUEST_MAX_AGE="${UPDATER_REQUEST_MAX_AGE:-600}"
MIN_FREE_KB="${UPDATER_MIN_FREE_KB:-1048576}"
KEEP_BACKUPS=10

JOB_ID=""
JOB_ACTION=""
JOB_STARTED=""
JOB_FROM=""
JOB_TO=""

# ─── Small helpers ───────────────────────────────────────────────

log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" >>"$STATE/job.log"; }

# One line of text, safe for the status files: no control characters
clean() { printf '%s' "$1" | tr -d '\000-\037\177' | cut -c1-300; }

# Write a status file atomically, readable by the app
publish() {
  local name="$1" tmp
  tmp=$(mktemp "$STATUS/.$name.XXXXXX") || return 1
  cat >"$tmp"
  chmod 0644 "$tmp"
  mv -f "$tmp" "$STATUS/$name"
}

write_job() {
  local state="$1" step="$2" message="${3:-}" finished=""
  case "$state" in running) ;; *) finished=$(date -u +%s) ;; esac
  publish job <<EOF
id=$JOB_ID
action=$JOB_ACTION
state=$state
step=$(clean "$step")
message=$(clean "$message")
from=$JOB_FROM
to=$JOB_TO
started_at=$JOB_STARTED
finished_at=$finished
EOF
  tail -n 300 "$STATE/job.log" 2>/dev/null | tr -d '\000-\010\013-\037\177' | publish log
}

step() { log "== $1"; write_job running "$1"; }

write_current() {
  local line
  line=$(git -C "$REPO_DIR" log -1 --format='%H%x09%ct%x09%s' 2>/dev/null) || return 0
  IFS=$'\t' read -r c d s <<<"$line"
  publish current <<EOF
commit=$c
date=$d
subject=$(clean "$s")
EOF
}

compose() { (cd "$REPO_DIR" && docker compose "$@"); }

# Run a command in the app container, running or not
in_web() {
  if compose ps --status running --services 2>/dev/null | grep -qx web; then
    compose exec -T web "$@"
  else
    compose run --rm --no-deps -T web "$@"
  fi
}

image_id() { docker image inspect -f '{{.Id}}' "$1" 2>/dev/null; }

running_image() {
  local cid
  cid=$(compose ps -q web 2>/dev/null | head -n1)
  [ -n "$cid" ] && docker inspect -f '{{.Image}}' "$cid" 2>/dev/null
}

wait_healthy() {
  local want="$1" waited=0
  while :; do
    if [ "$(running_image)" = "$want" ] &&
      compose exec -T web node -e \
        "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" \
        >>"$STATE/job.log" 2>&1; then
      return 0
    fi
    waited=$(awk -v a="$waited" -v b="$HEALTH_INTERVAL" 'BEGIN{print a+b}')
    if awk -v a="$waited" -v b="$HEALTH_TIMEOUT" 'BEGIN{exit !(a>=b)}'; then
      return 1
    fi
    sleep "$HEALTH_INTERVAL"
  done
}

backup_db() {
  local name="$1"
  in_web sh -c "mkdir -p /app/db/backups && sqlite3 /app/db/database.sqlite '.backup /app/db/backups/$name'" \
    >>"$STATE/job.log" 2>&1
}

restore_db() {
  local name="$1"
  compose stop web >>"$STATE/job.log" 2>&1
  compose run --rm --no-deps -T web sh -c \
    "cp /app/db/backups/$name /app/db/database.sqlite && rm -f /app/db/database.sqlite-wal /app/db/database.sqlite-shm" \
    >>"$STATE/job.log" 2>&1
}

prune_backups() {
  # Keep the newest $KEEP_BACKUPS pre-update backups; make backup's own are left alone
  ls -1t "$REPO_DIR"/db/backups/pre-update-*.sqlite 2>/dev/null |
    tail -n +$((KEEP_BACKUPS + 1)) | while read -r f; do rm -f -- "$f"; done
}

tree_is_clean() {
  [ -z "$(git -C "$REPO_DIR" status --porcelain --untracked-files=no 2>/dev/null)" ]
}

fail() {
  log "!! $1"
  write_job failed "${2:-Stopped}" "$1"
  return 1
}

# ─── check: what would an update bring in? ───────────────────────

do_check() {
  local now target head count list migrations=no ok=yes error=""
  now=$(date -u +%s)
  if ! git -C "$REPO_DIR" fetch --quiet origin "$BRANCH" 2>>"$STATE/check.log"; then
    ok=no; error="Could not reach GitHub to check for updates."
  fi
  head=$(git -C "$REPO_DIR" rev-parse HEAD)
  target=$(git -C "$REPO_DIR" rev-parse "origin/$BRANCH" 2>/dev/null || echo "")
  count=0; list=""
  if [ -n "$target" ] && [ "$target" != "$head" ]; then
    if git -C "$REPO_DIR" merge-base --is-ancestor "$head" "$target"; then
      count=$(git -C "$REPO_DIR" rev-list --count "$head..$target")
      list=$(git -C "$REPO_DIR" log -n 50 --format='%H%x09%ct%x09%s' "$head..$target" |
        tr -d '\000-\010\013-\037\177' | cut -c1-300)
      if git -C "$REPO_DIR" diff --name-only "$head" "$target" -- backend/migrations | grep -q .; then
        migrations=yes
      fi
    else
      ok=no; error="This server's code has changes that are not on $BRANCH. Update from the terminal."
    fi
  fi
  tree_is_clean || { ok=no; error="Files in the server's checkout were changed by hand. Update from the terminal."; }
  printf '%s\n' "$list" | sed '/^$/d' | publish available
  publish check <<EOF
checked_at=$now
ok=$ok
error=$error
branch=$BRANCH
target=$target
count=$count
migrations=$migrations
EOF
  write_current
}

# ─── The request: id from the inbox, details from the app's database ──

read_request() {
  local file="$INBOX/request" raw row action commit created now
  [ -f "$file" ] || return 2
  raw=$(head -c 64 "$file" | tr -d '[:space:]')
  rm -f -- "$file"
  if ! [[ "$raw" =~ ^[0-9a-f]{32}$ ]]; then
    JOB_ID="invalid"; JOB_ACTION="unknown"
    fail "Ignored a request that was not a valid id." "Checking the request"
    return 1
  fi
  JOB_ID="$raw"
  if grep -qx "$raw" "$STATE/processed" 2>/dev/null; then
    JOB_ACTION="unknown"
    fail "This request was already handled." "Checking the request"
    return 1
  fi
  echo "$raw" >>"$STATE/processed"
  row=$(in_web sqlite3 -readonly -separator '|' /app/db/database.sqlite \
    "SELECT action, IFNULL(target_commit, ''), created_at FROM update_requests WHERE id = '$raw';" 2>>"$STATE/job.log")
  IFS='|' read -r action commit created <<<"$row"
  now=$(date -u +%s)
  case "$action" in update|rollback) ;; *)
    JOB_ACTION="unknown"
    fail "No matching request was found in the app." "Checking the request"
    return 1 ;;
  esac
  JOB_ACTION="$action"
  if ! [[ "$created" =~ ^[0-9]+$ ]] || [ $((now - created)) -gt "$REQUEST_MAX_AGE" ] || [ $((created - now)) -gt 60 ]; then
    fail "The request is too old. Click again." "Checking the request"
    return 1
  fi
  if [ "$action" = update ] && ! [[ "$commit" =~ ^[0-9a-f]{40}$ ]]; then
    fail "The request did not name a valid version." "Checking the request"
    return 1
  fi
  REQ_COMMIT="$commit"
  return 0
}

# ─── update ──────────────────────────────────────────────────────

# Put a previous version back: image, database (when asked), checkout
restore_version() {
  local commit="$1" img="$2" backup="$3" with_db="$4"
  docker tag "$img" "$IMAGE:latest" >>"$STATE/job.log" 2>&1 || return 1
  if [ "$with_db" = yes ]; then
    [ -f "$REPO_DIR/db/backups/$backup" ] || { log "!! backup $backup is missing"; return 1; }
    restore_db "$backup" || return 1
  fi
  git -C "$REPO_DIR" reset --hard --quiet "$commit" >>"$STATE/job.log" 2>&1 || return 1
  compose up -d --no-build web >>"$STATE/job.log" 2>&1 || return 1
  wait_healthy "$(image_id "$IMAGE:latest")"
}

do_update() {
  local old target old_img new_img free migrations=no stamp backup
  step "Checking the server"
  tree_is_clean || { fail "Files in the server's checkout were changed by hand. Update from the terminal."; return 1; }
  free=$(df -Pk "$REPO_DIR" | awk 'NR==2 {print $4}')
  [ "${free:-0}" -ge "$MIN_FREE_KB" ] || { fail "Less than 1 GB of disk space is free."; return 1; }

  step "Fetching $BRANCH"
  git -C "$REPO_DIR" fetch --quiet origin "$BRANCH" >>"$STATE/job.log" 2>&1 ||
    { fail "Could not fetch from GitHub."; return 1; }
  old=$(git -C "$REPO_DIR" rev-parse HEAD)
  target=$(git -C "$REPO_DIR" rev-parse "origin/$BRANCH")
  JOB_FROM="$old"; JOB_TO="$target"
  [ "$target" = "$REQ_COMMIT" ] ||
    { fail "$BRANCH has changed since you looked. Reload the page and check the new list."; return 1; }
  [ "$old" != "$target" ] || { fail "Already up to date."; return 1; }
  git -C "$REPO_DIR" merge-base --is-ancestor "$old" "$target" ||
    { fail "$BRANCH is not a fast-forward of this server's code. Update from the terminal."; return 1; }
  if git -C "$REPO_DIR" diff --name-only "$old" "$target" -- backend/migrations | grep -q .; then
    migrations=yes
  fi

  step "Building the new version (the site stays up)"
  old_img=$(image_id "$IMAGE:latest")
  [ -n "$old_img" ] || old_img=$(running_image)
  [ -n "$old_img" ] || { fail "Could not find the running image."; return 1; }
  git -C "$REPO_DIR" merge --ff-only --quiet "$target" >>"$STATE/job.log" 2>&1 ||
    { fail "Could not move to the new code."; return 1; }
  if ! GIT_COMMIT="$target" compose build web >>"$STATE/job.log" 2>&1; then
    git -C "$REPO_DIR" reset --hard --quiet "$old"
    docker tag "$old_img" "$IMAGE:latest" >/dev/null 2>&1
    fail "The build failed. Nothing was changed."
    return 1
  fi
  new_img=$(image_id "$IMAGE:latest")

  step "Backing up the database"
  stamp=$(date -u +%Y%m%d-%H%M%S)
  backup="pre-update-$stamp.sqlite"
  if ! backup_db "$backup"; then
    git -C "$REPO_DIR" reset --hard --quiet "$old"
    docker tag "$old_img" "$IMAGE:latest" >/dev/null 2>&1
    fail "The database backup failed. Nothing was changed."
    return 1
  fi

  step "Starting the new version"
  compose up -d --no-build web >>"$STATE/job.log" 2>&1

  step "Checking the new version"
  if wait_healthy "$new_img"; then
    # Keep the old image tagged, so a rollback still finds it after a prune
    docker tag "$old_img" "$IMAGE:previous" >>"$STATE/job.log" 2>&1
    publish rollback <<EOF
commit=$old
subject=$(clean "$(git -C "$REPO_DIR" log -1 --format=%s "$old")")
date=$(git -C "$REPO_DIR" log -1 --format=%ct "$old")
image=$old_img
backup=$backup
db_restore=$migrations
updated_at=$(date -u +%s)
EOF
    cp "$STATUS/rollback" "$STATE/rollback"
    prune_backups
    write_current
    log "== Done"
    write_job succeeded "Done" "Updated to ${target:0:7}."
    return 0
  fi

  step "The new version did not start; rolling back"
  if restore_version "$old" "$old_img" "$backup" yes; then
    write_current
    write_job rolled_back "Rolled back" "The new version did not pass its health check, so the previous version and its database were put back."
  else
    write_current
    write_job failed "Rollback failed" "The new version failed and so did the rollback. Check the server from the terminal (make logs)."
  fi
  return 1
}

# ─── rollback: one step back, chosen by an admin ─────────────────

do_rollback() {
  local commit img backup with_db stamp
  step "Checking the previous version"
  [ -f "$STATE/rollback" ] || { fail "There is no previous version to go back to."; return 1; }
  tree_is_clean || { fail "Files in the server's checkout were changed by hand. Roll back from the terminal."; return 1; }
  commit=$(sed -n 's/^commit=//p' "$STATE/rollback")
  img=$(sed -n 's/^image=//p' "$STATE/rollback")
  backup=$(sed -n 's/^backup=//p' "$STATE/rollback")
  with_db=$(sed -n 's/^db_restore=//p' "$STATE/rollback")
  [[ "$commit" =~ ^[0-9a-f]{40}$ ]] && [[ "$img" =~ ^sha256:[0-9a-f]{64}$ ]] &&
    [[ "$backup" =~ ^pre-update-[0-9-]+\.sqlite$ ]] ||
    { fail "The saved previous version looks wrong. Roll back from the terminal."; return 1; }
  JOB_FROM=$(git -C "$REPO_DIR" rev-parse HEAD); JOB_TO="$commit"

  if [ "$with_db" = yes ]; then
    step "Backing up the current database"
    stamp=$(date -u +%Y%m%d-%H%M%S)
    backup_db "pre-rollback-$stamp.sqlite" || { fail "The database backup failed. Nothing was changed."; return 1; }
  fi

  step "Starting the previous version"
  if restore_version "$commit" "$img" "$backup" "$with_db"; then
    rm -f "$STATE/rollback"
    : | publish rollback
    write_current
    log "== Done"
    write_job succeeded "Done" "Back on ${commit:0:7}."
    do_check
    return 0
  fi
  write_current
  write_job failed "Rollback failed" "The previous version did not start. Check the server from the terminal (make logs)."
  return 1
}

# ─── Entry points ────────────────────────────────────────────────

setup_dirs() {
  mkdir -p "$INBOX" "$STATUS" "$STATE"
  chmod 0700 "$STATE"
}

do_run() {
  local status
  exec 9>"$STATE/lock"
  flock -w 1800 9 || return 1
  [ -f "$INBOX/request" ] || return 0
  : >"$STATE/job.log"
  JOB_STARTED=$(date -u +%s)
  REQ_COMMIT=""
  read_request
  status=$?
  [ $status -eq 2 ] && return 0
  [ $status -eq 0 ] || return 1
  log "Request $JOB_ID: $JOB_ACTION"
  if [ "$JOB_ACTION" = update ]; then
    do_update; status=$?
    do_check
  else
    do_rollback; status=$?
  fi
  return $status
}

main() {
  [ -d "$REPO_DIR/.git" ] || { echo "Not a Hidden Shelf checkout: $REPO_DIR" >&2; return 1; }
  setup_dirs
  case "${1:-}" in
    run) do_run ;;
    check)
      exec 9>"$STATE/lock"
      flock -n 9 || return 0
      do_check ;;
    watch)
      # For hosts without systemd: poll the inbox, check hourly
      local last=0
      while :; do
        [ -f "$INBOX/request" ] && ( do_run )
        if [ $(($(date -u +%s) - last)) -ge 3600 ]; then
          (exec 9>"$STATE/lock"; flock -n 9 && do_check)
          last=$(date -u +%s)
        fi
        sleep 5
      done ;;
    *) echo "Usage: $0 run|check|watch" >&2; return 64 ;;
  esac
}

main "$@"; exit $?
