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
  - `lib/Auth.php`, `lib/Database.php` - Core utilities

### Frontend (Vue 3)

- **Location:** `frontend/src/`
- **Framework:** Vue 3 with Composition API
- **Build Tool:** Vite
- **State Management:** Pinia
- **Routing:** Vue Router (hash-based: `#/dashboard`, `#/edit`, etc.)
- **Styling:** Tailwind CSS
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

## Code Style & Conventions

### Vue Components

- Use Composition API (`<script setup>`)
- Keep components focused and single-purpose
- Props should be typed and documented
- Emit events for parent communication
- Use composables for shared logic (e.g., `useTheme`)

### API Services

- One file per resource (e.g., `authApi.js`, `linksApi.js`)
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

- **Completed:** Core app, authentication, link management, categories, tags, profile, sharing
- **Legacy Files:** `public/index.html`, `public/login.html` (old Alpine.js app - deprecated)
- **Still Used:** `public/view.html` (public link viewer - not migrated yet)

### URL Structure

- **Vue App:** `/public/app/index.html` (built output)
- **Dev Server:** `http://localhost:5173` (Vite HMR)
- **PHP Server:** `http://localhost:8000` (serves built app + APIs)
- **Routes:** `#/dashboard`, `#/view`, `#/edit`, `#/profile`, `#/login`

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
- Icons: Material Symbols Outlined font

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
8. **Document new features** - When introducing new logic or features, update this file and README.md to keep documentation current
9. **Dev vs Prod** - Magic link and OAuth redirects use `redirect_origin` in dev mode to handle port differences (5173 vs 8000)

## File Locations Quick Reference

- **API Endpoints:** `api/*.php`
- **Vue Components:** `frontend/src/components/`
- **Vue Views:** `frontend/src/views/`
- **Pinia Stores:** `frontend/src/stores/`
- **API Services:** `frontend/src/services/api/`
- **Router:** `frontend/src/router/index.js`
- **Tests:** `frontend/src/**/*.test.js`
- **Config:** `vite.config.js`, `vitest.config.js`, `tailwind.config.js`

## Documentation

- Main README: `/README.md` (installation, architecture, Docker usage)
- Feature docs: `/.github/features.instructions.md` (legacy feature reference)
- API docs: See README "API Endpoints" section
