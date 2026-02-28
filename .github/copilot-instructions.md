# Hidden Shelf - Copilot Instructions

## Project Overview

Hidden Shelf is a link-saving and sharing application that has been **migrated from Alpine.js to Vue 3**. The backend remains PHP 8.x with SQLite, but the frontend is now a modern Vue 3 + Vite application.

## Architecture

### Backend (PHP)

- **Location:** `api/`, `lib/`
- **Framework:** None (vanilla PHP)
- **Database:** SQLite with PDO
- **Authentication:** Session-based with magic links + Google OAuth
- **Key Files:**
  - `api/auth.php` - Authentication endpoints
  - `api/links.php`, `api/categories.php`, `api/tags.php` - CRUD operations
  - `api/category_shares.php` - Sharing functionality
  - `api/link_visits.php` - Visit tracking for public links
  - `api/user_settings.php` - User preferences (brand color, etc.)
  - `lib/Auth.php`, `lib/Database.php` - Core utilities

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
   - Uses `#/` routes to avoid conflicts with PHP server routing
   - `.htaccess` redirects root and old URLs to `/public/app/index.html`

4. **Docker-First Development**
   - `make dev` - Start backend + Vue HMR dev server
   - `make build-frontend` - Build production Vue app
   - `make test-frontend` - Run tests in container
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

- **Completed:** Core app, authentication, link management, categories, tags, profile, sharing, import/export, context menus, category filter bar, brand colors, danger zone, category sharing UI, tag pill input, icon auto-prefix
- **Legacy Files:** `public/index.html`, `public/login.html` (old Alpine.js app - deprecated)
- **Still Used:** `public/view.html` (public link viewer - Alpine.js, not migrated)

### URL Structure

- **Vue App:** `/public/app/index.html` (built output)
- **Dev Server:** `http://localhost:5173` (Vite HMR)
- **PHP Server:** `http://localhost:8000` (serves built app + APIs)
- **Routes:** `#/dashboard`, `#/view`, `#/edit`, `#/profile`, `#/login`
- **Public Links:** `/public/view.html?hash={hash}` or `/h/{hash}` (short URL)
- **Public Links (no redirect):** Append `&stay` to prevent direct redirect (e.g., `?hash=abc&stay`)

### Environment Variables

- `VITE_API_PROXY_TARGET` - API proxy target (default: `http://localhost:8000`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- See `docker-compose.yml` for full list

## Common Tasks

### Adding a New Feature

1. Create API endpoint in `api/` if needed
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
- Backend changes in `api/*.php`

### Testing Changes

- Run locally: `cd frontend && npm run test`
- Run in Docker: `make test-frontend`
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
9. **Dev vs Prod** - Magic link and OAuth redirects use `redirect_origin` in dev mode to handle port differences (5173 vs 8000)
10. **Modals must use Teleport** - Always wrap modal/overlay markup in `<Teleport to="body">` to avoid inheriting parent layout styles
11. **MDI icons, not Material Symbols** - The project uses `@mdi/font` CDN, not Google Material Symbols
12. **Delete confirmations use modals** - Never use `window.confirm()` — all destructive actions use a styled confirmation modal with Teleport
13. **Icon auto-prefix** - The `LinkFormModal` auto-prepends `mdi-` if the user omits it (e.g., typing "wifi" becomes "mdi-wifi")
14. **Favicon** - `favicon.png` lives in both `public/` (PHP) and `frontend/public/` (Vite dev). HTML references `/favicon.png`

## File Locations Quick Reference

- **API Endpoints:** `api/*.php`
- **Vue Components:** `frontend/src/components/`
  - `layout/` — `AppShell.vue`, `TopNav.vue`
  - `links/` — `LinkCardView.vue`, `LinkCardEdit.vue`, `LinkFormModal.vue`
  - `categories/` — `CategoryManager.vue`, `CategoryFilterBar.vue`
  - `tags/` — `TagManager.vue`
  - `common/` — `BaseModal.vue`, `ContextMenu.vue`, `ImportExportModal.vue`
  - `feedback/` — `ToastList.vue`
- **Vue Views:** `frontend/src/views/` (`LoginView`, `DashboardView`, `ViewLinksView`, `EditLinksView`, `ProfileView`)
- **Pinia Stores:** `frontend/src/stores/` (`app.js`, `auth.js`, `toast.js`)
- **API Services:** `frontend/src/services/api/` (`authApi.js`, `linksApi.js`, `categoriesApi.js`, `tagsApi.js`, `sharesApi.js`, `settingsApi.js`)
- **HTTP Client:** `frontend/src/lib/httpClient.js`
- **Composables:** `frontend/src/composables/useTheme.js`
- **Router:** `frontend/src/router/index.js`
- **Tests:** `frontend/src/**/*.test.js`
- **Vite Config:** `frontend/vite.config.js`
- **Vitest Config:** `frontend/vitest.config.js`
- **Tailwind Config:** `tailwind.config.js` (project root)
- **Public Link Viewer:** `public/view.html` (Alpine.js, not yet migrated)

## Documentation

- Main README: `/README.md` (installation, architecture, Docker usage)
- Feature docs: `/.github/features.instructions.md` (comprehensive feature reference)
- API docs: See README "API Endpoints" section
