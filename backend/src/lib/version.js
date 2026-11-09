/**
 * The version this server runs, as people see it: the release tag
 * ("v1.2.0"), else the branch and short commit ("main · abc1234"), else
 * just the commit. Empty when the build doesn't say (e.g. local dev).
 *
 * Set by make (GIT_COMMIT, GIT_TAG, GIT_BRANCH build args) and, for a
 * version installed from the app, by the supervisor when it starts it.
 */

import config from "../config.js";

export function appVersion() {
  if (config.gitTag) return config.gitTag;
  const short = config.gitCommit.slice(0, 7);
  if (!short) return "";
  return config.gitBranch ? `${config.gitBranch} · ${short}` : short;
}
