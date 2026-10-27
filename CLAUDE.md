# Hidden Shelf: notes for Claude

Read `.github/copilot-instructions.md` first. It covers the architecture,
conventions and commands, and it applies to you as well.

## Every change

- Add or update tests for what you change. Frontend: `cd frontend && npx vitest run`.
  Backend: `cd backend && npx vitest run`. Both must pass, with no `FAIL` lines.
- Every `<button>` and `<a>` needs a `title`. `src/hoverTitles.test.js` checks this.
- Don't commit the build output in `public/app/`.

## Keep the user-facing docs in step

When you add, change or remove something users can see or do, update
these in the same change:

1. **`frontend/src/content/features.js`**: the feature list and the FAQ.
   - The front page (`LoginView`) shows the features marked `front: true`.
     Keep that list short: the strongest reasons to use the app.
   - The Help page (`/help`, `HelpView`) shows every feature and the FAQ.
   - Write for users rather than developers: say what they can do, not how it's
     built. Each feature is one or two sentences ending in a full stop.
   - Add an FAQ entry when a feature raises a question (privacy, "where
     do I find…", what happens to my data).
   - Only describe what the app actually does. Check the code before
     you claim it.
2. **`.github/features.instructions.md`**: the technical reference
   (components, routes, endpoints, tables).

If a change makes a feature or answer wrong, fix it there too. Removing a
feature means removing its entry.
