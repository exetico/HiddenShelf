/**
 * Whether a page sits inside the app (top bar and all). Public pages stand
 * alone, except those marked shellWhenSignedIn (Help) when you're signed in.
 */
export function usesAppShell(meta = {}, signedIn = false) {
  if (meta.public !== true) return true;
  return Boolean(meta.shellWhenSignedIn && signedIn);
}
