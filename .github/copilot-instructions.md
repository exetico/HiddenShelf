# Hidden Shelf - Copilot Instructions

## Project Overview

Hidden Shelf is a link-saving and sharing application. The backend is **Node.js + Hono** with SQLite (migrated from PHP), and the frontend is a Vue 3 + Vite application.

### Once you're prompted

You need to read the copilot-instructions, and if you introduce features, you must add tests for them, and document them, in features-instructions.md.

## Architecture

### Backend (Hono.js)

- **Location:** `backend/src/`
- **Framework:** Hono 4.x with @hono/node-server
- **Database:** SQLite with better-sqlite3 (synchronous)
- **Authentication:** Cookie-based sessions with magic links + Google OAuth
- **Key Files:**
  - `backend/src/index.js` - Server entry point
  - `backend/src/config.js` - Configuration from env vars
  - `backend/src/routes/auth.js` - Authentication endpoints
  - `backend/src/routes/links.js`, `categories.js`, `tags.js` - CRUD operations
  - `backend/src/routes/shares.js` - Sharing functionality
  - `backend/src/routes/linkVisits.js` - Visit tracking for public links
  - `backend/src/routes/settings.js` - User preferences (brand color, etc.)
  - `backend/src/routes/config.js` - Public app config
  - `backend/src/routes/account.js` - Bulk account operations (delete all data)
  - `backend/src/lib/database.js` - SQLite wrapper + migration runner
  - `backend/src/lib/helpers.js` - Utility functions
  - `backend/src/lib/mailer.js` - Email sending (nodemailer)
  - `backend/src/middleware/session.js` - Cookie session middleware
  - `backend/src/middleware/auth.js` - Auth guards (requireAuth, optionalAuth)
- **Testing:** `backend/tests/*.test.js` (Vitest)

### Frontend (Vue 3)

- **Location:** `frontend/src/`
- **Framework:** Vue 3 with Composition API
- **Build Tool:** Vite
- **State Management:** Pinia
- **Routing:** Vue Router (hash-based: `#/dashboard`, `#/edit`, etc.)
- **Styling:** Tailwind CSS
- **Icons:** MDI (Material Design Icons) via `@mdi/font` CDN (`<i class="mdi mdi-*">` syntax)
- **Testing:** Vitest + Vue Testing Library

### Key Design Decisions

1. **Backend Abstraction Layer**
   - All API calls go through `frontend/src/services/api/` modules
   - Makes future backend migration easier (no hardcoded endpoints in components)
   - Centralized error handling and HTTP client logic

2. **Component-Based Architecture**
   - Components organized by feature (links, categories, tags, layout)
   - Reusable UI components in `components/common/`
   - View components for each route in `views/`

3. **Hash-Based Routing**
   - Uses `#/` routes to avoid conflicts with server routing
   - Hono serves the Vue app at `/public/app/index.html`

4. **Docker-First Development**
   - `make dev` - Start backend + Vue HMR dev server
   - `make build-frontend` - Build production Vue app
   - `make test` - Run all tests (frontend + backend)
   - HMR works in Docker via `CHOKIDAR_USEPOLLING=true`

5. **Teleport Pattern for Modals**
   - All modals and overlays use `<Teleport to="body">` to escape parent layout styles
   - Prevents inheriting Tailwind `space-y-*` margins from parent containers
   - Applies to: `BaseModal`, `ContextMenu`, `ImportExportModal` progress overlay, `ProfileView` delete overlay

6. **Brand Color System**
   - Custom brand color stored in user settings
   - `applyBrandColor(hex)` in `app.js` store generates 11 CSS custom properties (--brand-50 through --brand-950)
   - Uses clamp-based shade algorithm with offsets: +80, +60, +40, +25, +10, 0, -15, -30, -50, -65, -85

## Code Style & Conventions

### Vue Components

- Use Composition API (`<script setup>`)
- Keep components focused and single-purpose
- Props should be typed and documented
- Emit events for parent communication
- Use composables for shared logic (e.g., `useTheme`)

### API Services

- One file per resource (e.g., `authApi.js`, `linksApi.js`, `settingsApi.js`, `sharesApi.js`)
- Export object with methods (not default export)
- Use the shared `httpClient` for all requests
- Return data directly (errors are thrown)

### State Management (Pinia)

- One store per logical domain (auth, app, toast)
- Use getters for derived state
- Keep actions async when calling APIs
- Don't directly mutate state outside stores

### Testing

- Test files alongside source: `*.test.js`
- Mock API calls and router in tests
- Test user interactions, not implementation details
- Run tests before committing: `npm run test`

## Important Context

### Migration Status

- **Completed:** Core app, authentication, link management, categories, tags, profile, sharing, import/export, context menus, category filter bar, brand colors, danger zone, category sharing UI, tag pill input, icon auto-prefix, edit mode search/filter, category collapse/expand, X of Y counter, join share verify/preview flow, pending share code persistence, remove member/sharing, shared-with-me in CategoryManager, app version display, toast progress bar, dashboard theme toggle, public/private emoji on edit cards, Delete Everything styled modal, Danger Zone smooth animation, PHP→Hono backend migration, security audit (rate limiting, open redirect prevention, CORS hardening, input validation, URL protocol whitelist, debug mode default, session cookie flags), code quality review (N+1 query fixes, category data integrity, ownership validation, bulk delete endpoint, modal accessibility, timer leak fix, short URL validation, migration error handling), **migration testing (14 tests for all 7 migrations)**
- **Still Used:** `public/view.html` (public link viewer - Alpine.js, not migrated)

### URL Structure

- **Vue App:** `/public/app/index.html` (built output)
- **Dev Server:** `http://localhost:5173` (Vite HMR)
- **Backend Server:** `http://localhost:3000` (Hono, serves built app + APIs)
- **Routes:** `#/dashboard`, `#/view`, `#/edit`, `#/profile`, `#/login`
- **Public Links:** `/public/view.html?hash={hash}` or `/h/{hash}` (short URL)
- **Public Links (no redirect):** Append `&stay` to prevent direct redirect (e.g., `?hash=abc&stay`)

### Environment Variables

- `VITE_API_PROXY_TARGET` - API proxy target (default: `http://localhost:3000`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- See `docker-compose.yml` for full list

## Common Tasks

### Adding a New Feature

1. Create API endpoint in `backend/src/routes/` if needed
2. Add API service method in `frontend/src/services/api/`
3. Create/update Pinia store if state is needed
4. Build UI components in `frontend/src/components/`
5. Add route to `frontend/src/router/` if needed
6. Write tests in `*.test.js` files

### Updating the UI

- Components: `frontend/src/components/`
- Views: `frontend/src/views/`
- Styles: Use Tailwind utility classes
- Icons: MDI font — use `<i class="mdi mdi-icon-name">` (browse at [pictogrammers.com](https://pictogrammers.com/library/mdi/))

### API Changes

- Update service module in `frontend/src/services/api/`
- Update tests that mock those calls
- Backend changes in `backend/src/routes/`

### Testing Changes

- Run locally: `cd frontend && npm run test`
- Run in Docker: `make test-frontend`
- Backend tests: `cd backend && npm run test`
- Run in Docker: `make test-backend`
- Coverage report: `npm run test:coverage`

## Things to Remember

1. **Don't hardcode API URLs** - Use the API service layer
2. **Test redirect loops** - Auth guard can cause infinite redirects if misconfigured
3. **Hash routing** - Always use `#/route`, not `/route`
4. **Docker HMR** - File changes should trigger hot reload; if not, check `CHOKIDAR_USEPOLLING`
5. **Legacy files** - Don't edit `public/index.html` or `public/login.html` (use Vue app)
6. **Magic links in logs** - Check `docker compose logs -f web` for login links in dev
7. **Google OAuth** - Callback redirects to `#/login?error=...` on failure
8. **Document new features** - When introducing new logic or features, update this file, `features.instructions.md`, and `README.md` to keep documentation current
9. **Dev vs Prod** - Magic link and OAuth redirects use `redirect_origin` in dev mode to handle port differences (5173 vs 3000)
10. **Modals must use Teleport** - Always wrap modal/overlay markup in `<Teleport to="body">` to avoid inheriting parent layout styles
11. **MDI icons, not Material Symbols** - The project uses `@mdi/font` CDN, not Google Material Symbols
12. **Delete confirmations use modals** - Never use `window.confirm()` — all destructive actions use a styled confirmation modal with Teleport
13. **Icon auto-prefix** - The `LinkFormModal` auto-prepends `mdi-` if the user omits it (e.g., typing "wifi" becomes "mdi-wifi")
14. **Favicon** - `favicon.png` lives in both `public/` (PHP) and `frontend/public/` (Vite dev). HTML references `/favicon.png`
15. **Test migrations before deploying** - Run `cd backend && npm test tests/migrations.test.js` to verify all database migrations work. Catches SQLite errors like "Cannot add a column with non-constant default" before production deployment

## File Locations Quick Reference

- **API Endpoints:** `backend/src/routes/*.js`
- **Vue Components:** `frontend/src/components/`
  - `layout/` — `AppShell.vue`, `TopNav.vue`
  - `links/` — `LinkCardView.vue`, `LinkCardEdit.vue`, `LinkFormModal.vue`
  - `categories/` — `CategoryManager.vue`, `CategoryFilterBar.vue`
  - `tags/` — `TagManager.vue`
  - `common/` — `BaseModal.vue`, `ContextMenu.vue`, `ImportExportModal.vue`
  - `feedback/` — `ToastList.vue`
- **Vue Views:** `frontend/src/views/` (`LoginView`, `DashboardView`, `ViewLinksView`, `EditLinksView`, `ProfileView`)
- **Pinia Stores:** `frontend/src/stores/` (`app.js`, `auth.js`, `toast.js`)
- **API Services:** `frontend/src/services/api/` (`authApi.js`, `linksApi.js`, `categoriesApi.js`, `tagsApi.js`, `sharesApi.js`, `settingsApi.js`, `accountApi.js`)
- **HTTP Client:** `frontend/src/lib/httpClient.js`
- **Composables:** `frontend/src/composables/useTheme.js`
- **Router:** `frontend/src/router/index.js`
- **Frontend Tests:** `frontend/src/**/*.test.js`
- **Backend Tests:** `backend/tests/*.test.js`
- **Vite Config:** `frontend/vite.config.js`
- **Vitest Config:** `frontend/vitest.config.js`
- **Tailwind Config:** `tailwind.config.js` (project root)
- **Public Link Viewer:** `public/view.html` (Alpine.js, not yet migrated)

## Documentation

- Main README: `/README.md` (installation, architecture, Docker usage)
- Feature docs: `/.github/features.instructions.md` (comprehensive feature reference)
- API docs: See README "API Endpoints" section
