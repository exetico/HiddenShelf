#!/usr/bin/env bash
# Installs (or removes) the Hidden Shelf host updater as systemd units.
#
#   sudo deploy/updater/install.sh            install for the user running sudo
#   sudo deploy/updater/install.sh --remove   remove the units
#
# The updater runs as that user, who must be able to run docker (the same
# user that runs "make up" today). Nothing runs as root after install.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UNITS=(hiddenshelf-updater.service hiddenshelf-updater.path hiddenshelf-updater-check.service hiddenshelf-updater-check.timer)
TARGET=/etc/systemd/system

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo $0" >&2; exit 1; }
command -v systemctl >/dev/null || {
  echo "systemd was not found. Run '$DIR/deploy/updater/hiddenshelf-updater.sh watch' under your own supervisor instead." >&2
  exit 1
}

if [ "${1:-}" = "--remove" ]; then
  systemctl disable --now hiddenshelf-updater.path hiddenshelf-updater-check.timer 2>/dev/null || true
  for u in "${UNITS[@]}"; do rm -f "$TARGET/$u"; done
  systemctl daemon-reload
  echo "Updater removed. The app's Update panel will say the updater is not running."
  exit 0
fi

USER_NAME="${SUDO_USER:-}"
[ -n "$USER_NAME" ] && [ "$USER_NAME" != root ] || {
  echo "Run this with sudo from the account that runs Hidden Shelf (not as root directly)." >&2
  exit 1
}
sudo -u "$USER_NAME" docker info >/dev/null 2>&1 || {
  echo "$USER_NAME can't run docker. Add it to the docker group first." >&2
  exit 1
}
case "$DIR" in *[!A-Za-z0-9/._-]*) echo "The folder path $DIR has characters systemd units can't hold. Move it to a plain path." >&2; exit 1 ;; esac

# Folders the app and the updater share. The app (user "node" in the
# container) may only drop a file in inbox/ (write, no listing) and read status/.
install -d -o "$USER_NAME" -m 0755 "$DIR/control" "$DIR/control/status"
install -d -o "$USER_NAME" -m 1733 "$DIR/control/inbox"
install -d -o "$USER_NAME" -m 0700 "$DIR/control/state"

for u in "${UNITS[@]}"; do
  sed -e "s#@USER@#$USER_NAME#g" -e "s#@DIR@#$DIR#g" "$DIR/deploy/updater/$u" >"$TARGET/$u"
  chmod 0644 "$TARGET/$u"
done
systemctl daemon-reload
systemctl enable --now hiddenshelf-updater.path hiddenshelf-updater-check.timer
sudo -u "$USER_NAME" "$DIR/deploy/updater/hiddenshelf-updater.sh" check || true

echo "Updater installed for $USER_NAME in $DIR."
echo "Set UPDATE_ADMIN_EMAILS in .env and run 'make up' to show the Update panel to those admins."
