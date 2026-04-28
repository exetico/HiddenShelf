# Hidden Shelf - Complete Feature Documentation

This document provides a comprehensive overview of all features, functionality, and technical details in the current Hidden Shelf implementation (Vue 3 edition). It serves as the definitive reference for every feature in the app.

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Authentication System](#authentication-system)
3. [User Interface Components](#user-interface-components)
4. [Link Management](#link-management)
5. [Category System](#category-system)
6. [Tag System](#tag-system)
7. [Sharing & Collaboration](#sharing--collaboration)
8. [Import/Export Features](#importexport-features)
9. [Theming & Customization](#theming--customization)
10. [Database Schema](#database-schema)
11. [API Endpoints](#api-endpoints)
12. [Public Link Viewing](#public-link-viewing)
13. [Security Features](#security-features)
14. [Configuration](#configuration)
15. [Testing](#testing)

## Core Architecture

### Tech Stack

- **Backend**: Node.js + Hono 4.x with better-sqlite3
- **Database**: SQLite with migration system
- **Frontend**: Vue 3 (Composition API + `<script setup>`), Vite 5, Pinia, Vue Router (hash-based)
- **Styling**: Tailwind CSS 3.4
- **Icons**: MDI (Material Design Icons) via `@mdi/font` CDN — `<i class="mdi mdi-*">` syntax
- **Authentication**: Magic link email authentication (passwordless) + Google OAuth
- **Session Management**: Cookie-based sessions with in-memory store
- **Testing**: Vitest 1.6 + @vue/test-utils + jsdom (frontend), Vitest (backend)

### File Structure

```
├── backend/                    # Hono.js backend
│   ├── src/routes/             # API route modules
│   ├── src/lib/                # Database, helpers, mailer
│   ├── src/middleware/          # Session, auth guards
│   └── tests/                  # Backend tests
├── db/migrations/              # SQLite migration SQL files
├── public/                     # Static files + view.html (public link viewer)
├── frontend/                   # Vue 3 application
│   ├── src/
│   │   ├── components/         # Vue components by feature
│   │   │   ├── categories/     # CategoryManager, CategoryFilterBar
│   │   │   ├── common/         # BaseModal, ContextMenu, ImportExportModal
│   │   │   ├── feedback/       # ToastList
│   │   │   ├── layout/         # AppShell, TopNav
│   │   │   ├── links/          # LinkCardView, LinkCardEdit, LinkFormModal
│   │   │   └── tags/           # TagManager
│   │   ├── composables/        # useTheme
│   │   ├── lib/                # httpClient
│   │   ├── router/             # Vue Router index.js (hash mode)
│   │   ├── services/api/       # API service modules (one per resource)
│   │   ├── stores/             # Pinia stores (app, auth, toast)
│   │   ├── test/               # Test setup
│   │   └── views/              # Route views (Login, Dashboard, View, Edit, Profile)
│   ├── vite.config.js
│   └── vitest.config.js
├── tailwind.config.js          # Tailwind configuration (for view.html)
└── docker-compose.yml          # Docker dev/build/test profiles
```

### Key Design Patterns

- **Backend Abstraction Layer** — All API calls go through `frontend/src/services/api/` modules. No hardcoded endpoints in components.
- **Component-Based Architecture** — Components organized by feature domain with reusable common components.
- **Hash-Based Routing** — Uses `#/` routes (e.g. `#/dashboard`, `#/edit`) to avoid conflicts with server routing. A catch-all route (`/:pathMatch(.*)*`) redirects unknown URLs to `#/dashboard` and shows a toast notification.
- **Teleport Pattern for Modals** — All modals/overlays use `<Teleport to="body">` to escape parent layout styles.
- **Docker-First Development** — `make dev` for HMR, `make build-frontend` for production, `make test` for all tests.

## Authentication System

### Magic Link Authentication

- **Email-based login**: No passwords required
- **One-time tokens**: 15-minute expiry for security
- **Session persistence**: 30-day session lifetime
- **Google OAuth integration**: Alternative login method via `backend/src/routes/auth.js` (Google OAuth endpoints)
- **Return URL support**: Redirect users after login

### Login Flow Features

- Remember email addresses on device
- Welcome back flow for returning users
- **Share code handling during login**: If a `?share=CODE` param is present, it's saved to `sessionStorage` before login so it survives the auth redirect. After login, `checkPendingShare()` in the app store picks it up and triggers the join flow.
- Beta service disclaimer and data retention warnings
- Automatic session validation on app load via `authApi.me()`

### Implementation

- **View**: `LoginView.vue` — extracts `share` query param, stores to sessionStorage, shows email/magic-link form + Google OAuth button
- **Store**: `auth.js` — manages `user`, `isAuthenticated`, calls `authApi.login()` / `authApi.me()`
- **API**: `authApi.js` → `/api/auth/*`
- **Backend**: `backend/src/routes/auth.js` — token generation, session management

## User Interface Components

### Main Navigation (`TopNav.vue`)

- Mode switching tabs: Dashboard, View, Edit, Profile
- User avatar with initials
- Responsive design

### Layout (`AppShell.vue`)

- Wraps all authenticated views
- Handles route-to-tab mapping
- Provides consistent page frame

### Core Views

#### Dashboard (`DashboardView.vue`)

- Welcome message with user greeting
- **Clickable statistics grid**: Cards for total links, categories, and tags — click any card to navigate to `#/edit`
- **`totalCategories` includes shared categories**: The getter sums own categories + shared categories from `sharedCategories` state
- **Visit stats section**: Shows total visits and top 5 most-visited links for the last 30 days (loaded via `appStore.loadVisitStats()` on mount); section is hidden when no visits have occurred
- **4 quick action buttons**: View links → `#/view`, Edit links → `#/edit`, Profile → `#/profile`, Import Data → `#/profile`
- **Theme toggle section**: Shows current mode label ("Light mode" / "Dark mode") with sun/moon icon toggle button

#### View Mode (`ViewLinksView.vue`)

- **Category-organized link display**: Links grouped under category headers with colored borders
- **"Showing X of Y" counter**: Displays `Showing {links.length} of {total} links` at the top
- **Collapsible category sections**: Click category header or chevron to collapse/expand; chevron rotates (`mdi-chevron-down` → `mdi-chevron-right`); collapsed state tracked per-category in `collapsedCategories` reactive Set
- **Category filter bar** (`CategoryFilterBar.vue`): Filter visible links by category
- **Context menu**: Right-click (desktop) or long-press (mobile) on link cards for quick actions
- **Pagination**: "Load more" button when `links.length < total`
- **Shared category owner badge**: Shows owner email next to shared category headers
- **Empty state**: `mdi-link-off` icon with "No links yet" message when no links exist
- **Link count per group**: Category headers show count of links in that group

#### Edit Mode (`EditLinksView.vue`)

- **Search input**: `<input type="search" placeholder="Search links...">` — debounced 300ms sync to `appStore.search`, triggers `loadLinks({ reset: true })`
- **Category filter dropdown**: `<select>` with "All Categories" + category list — immediate sync (no debounce) to `appStore.filterCategory`, triggers `loadLinks({ reset: true })`
- **"Showing X of Y" counter**: Same pattern as View mode
- **Action buttons**: "+ Add link", "Categories", "Tags" — open respective modals
- **Link cards** (`LinkCardEdit.vue`): Edit-mode cards with public/private emoji, edit/delete actions
- **Empty state**: `mdi-link-off` icon with "No links yet" message
- **Pagination**: "Load more" button
- **Modal management**: `LinkFormModal`, `CategoryManager`, `TagManager` opened via boolean refs

#### Profile (`ProfileView.vue`)

- Email display with user info
- **Beta notice / Data retention disclaimer**: Amber notice box informing users the service is in beta and data may be reset; includes "export your data" button link to open ImportExportModal
- **App version display**: Shows version from `appConfig.version` (fetched via `configApi.get()`)
- **Join Shared Category section**:
  - Input field with placeholder "Paste share URL or code..."
  - **URL detection**: `extractShareCode()` regex extracts code from full URLs (e.g., `?share=CODE`) or raw codes
  - "Verify" button calls `sharesApi.verifyShareCode(code)`
  - **Preview modal** (Teleport): On successful verification, shows category name, owner email, link count → "Join" / "Cancel" buttons
  - Error handling: Shows error message in red for invalid/expired codes
- **Shared categories list**: Lists categories shared with the user, each with owner info and "Leave" button
- **Danger Zone** (collapsible with smooth `<transition>` animation):
  - Toggle button expands/collapses section
  - **Delete Everything modal** (Teleport): Requires typing exact phrase "delete N now" (where N = link count) to enable the delete button. Calls `linksApi.deleteAll()` etc.
  - Other destructive actions (delete account, etc.)
- **Import/Export**: Opens `ImportExportModal` component
- **Brand color picker**: Custom brand color with live preview

### Common Components

#### BaseModal (`BaseModal.vue`)

- Reusable modal with Teleport to body
- Title, body slot, close button
- Backdrop click to dismiss

#### ContextMenu (`ContextMenu.vue`)

- Right-click / long-press context menu
- Teleported to body
- Position-aware (avoids screen edges)

#### ImportExportModal (`ImportExportModal.vue`)

- Tab interface: Import / Export
- JSON file upload with validation
- Progress overlay (Teleport) during import
- Default category color: `#687061`

### Feedback Components

#### ToastList (`ToastList.vue`)

- Renders toast notifications from `toastStore.items`
- **CSS classes per type**: success (green), error (red), info (blue)
- **Progress bar**: Each toast has a `<div class="toast-progress">` with CSS `@keyframes shrink` animation, duration set to `item.duration` ms (default 3500ms)
- **Click to dismiss**: Clicking a toast removes it immediately via `toastStore.remove(id)`
- Multiple toasts stack vertically

## Link Management

### Core Link Properties

- **URL**: Target destination (required)
- **Title**: Display name (required)
- **Description**: Optional detailed description
- **Icon**: Material Design Icons support — auto-prefixed with `mdi-` if omitted (e.g., "wifi" → "mdi-wifi") in `LinkFormModal`
- **Category**: Single category assignment (via dropdown)
- **Tags**: Multiple tag assignment (pill-based input)
- **Public/Private**: Visibility toggle
- **Direct Redirect**: Skip preview page option
- **Display Order**: Custom positioning

### Link Card — View Mode (`LinkCardView.vue`)

- Displays title, description (or URL fallback), icon, category color border
- Click opens URL in new tab
- Public links show share button
- Context menu on right-click / long-press

### Link Card — Edit Mode (`LinkCardEdit.vue`)

- **Public/Private emoji**: 🔓 (public, title="Public") / 🔒 (private, title="Private") displayed next to title
- Title, description (URL fallback if empty), icon
- **Tag pills**: Up to 3 tags shown as styled pills with "+N more" overflow
- **Direct redirect badge**: Amber "⚡ redirect" badge shown when `direct_redirect` is set on the link
- **Visit count**: Shows total visit count (eye icon + number) for public links that have at least one visit; `total_visits` field is batch-fetched from the backend alongside tags in the links list API
- **Copy public URL**: Visible only for public links — emits `copyPublic` with link hash
- Edit button: Opens `LinkFormModal` with link data
- Delete button: Emits `delete` with link ID (confirmation handled by parent)

### Link Form (`LinkFormModal.vue`)

- Full CRUD form in modal (Teleport)
- URL, title, description, icon (with auto-prefix + live preview), category dropdown, tag pill input
- **Icon auto-prefix**: Typing "wifi" auto-becomes "mdi-wifi" with live icon preview
- **Visit count display (edit mode)**: When editing an existing link, fetches visit stats via `linkVisitsApi.getSummary({ linkId })` and displays total visits below the public/redirect toggles
- Create / Update mode

### Link Operations

- **Create**: via `linksApi.create()`
- **Read**: via `linksApi.list()` with pagination, search, category filter
- **Update**: via `linksApi.update()`
- **Delete**: via `linksApi.remove()` with styled confirmation modal
- **Reorder**: Move links up/down in display order

### Public Link Sharing

- **Unique Hash Generation**: Each link gets a unique identifier
- **Preview Page**: Default landing page with metadata (`public/view.html`)
- **Direct Redirect**: Optional immediate redirect with "stay on page" cancel
- **Visit Tracking**: Analytics via `/api/link_visits`
- **Share URL Format**: `/h/{hash}` short URLs, `/public/view.html?hash={hash}` full URLs

## Category System

### Category Features

- **Name**: Category display name
- **Icon**: Material Design Icons
- **Color**: Custom hex color with live preview
- **Default Redirect**: Auto-apply direct redirect to new links in this category
- **Link Count**: Automatic counting of contained links
- **Display Order**: Custom category ordering

### Category Operations

- **Create**: Add via `CategoryManager` — emits create event
- **Edit**: Toggle edit mode per-category, modify name/icon/color
- **Delete**: Styled confirmation modal (never `window.confirm`)
- **Share**: Share categories with other users (see Sharing section)
- **Filter**: Filter links by category in both View and Edit modes

### CategoryManager (`CategoryManager.vue`)

- Lists all user-owned categories with link counts
- Create / edit / delete operations
- **Share button per category**: Opens share modal with URL, copy button, member list
- **Remove member**: Revoke a specific member's access via `sharesApi.removeMember()`
- **Remove sharing**: Delete the entire share via `sharesApi.removeSharing()` with confirmation
- **"Shared with me" section**: Displayed at the bottom when user has shared categories; lists each shared category with owner info and "Leave" button

### Special Categories

- **Uncategorized**: Automatic grouping for links without a category
- **Shared Categories**: Categories shared by other users, visually distinguished with owner badge

## Tag System

### Tag Properties

- **Name**: Tag identifier (unique per user)
- **Usage Count**: Number of links using the tag
- **User-scoped**: Tags are private to each user

### Tag Operations

- **Create**: Add new tags via link editing (pill input)
- **Assign**: Multi-select tag assignment to links
- **Remove**: Delete tags with confirmation modal
- **Filter**: View links by tag
- **Bulk Apply**: Add tags to multiple links

### Tag Display

- **Link Cards**: Show up to 3 tags as styled pills, with "+N more" indicator for overflow
- **Tag Input** (`LinkFormModal`): Pill-based input with Enter/comma to add; Backspace to remove last; styled labels with × remove button
- **Tag Management** (`TagManager.vue`): Dedicated interface for tag operations with delete confirmation modals

## Sharing & Collaboration

### Category Sharing System

- **Share Code Generation**: Unique codes for category access via `sharesApi.createCategoryShare()`
- **Share UI in Category Manager**: Share button per category → modal with share URL, copy button, and member list
- **Public Share Links**: URLs with embedded share codes (e.g., `?share=CODE`)
- **Member Management**: View members with access, remove individual members
- **Permission Model**: Read-only access to shared content

### Join Shared Category Flow

1. **Enter share code/URL** in Profile view input field
2. **Verify**: `sharesApi.verifyShareCode(code)` returns category preview (name, owner, link count)
3. **Preview modal**: Shows category details with "Join" / "Cancel" buttons
4. **Confirm join**: `sharesApi.acceptShare(code)` adds user as member
5. **Category appears** in user's "Shared with me" section

### Pending Share Code (Login Integration)

1. User visits app with `?share=CODE` in URL
2. `LoginView` extracts `share` query param → stores to `sessionStorage('pending_share_code')`
3. User logs in via magic link or Google OAuth
4. `app.js` store's `checkPendingShare()` reads from sessionStorage → triggers verify/join flow
5. Share code is cleared from sessionStorage after processing

### Share Management

- **View Members**: See all users with access in CategoryManager share modal
- **Remove Members**: Revoke individual access (`sharesApi.removeMember(categoryId, memberId)`)
- **Delete Share**: Remove sharing entirely (`sharesApi.removeSharing(categoryId)`) with confirmation
- **Leave Shared**: Users can leave categories shared with them

### Share Code Features

- **URL Detection**: `extractShareCode()` regex auto-extracts codes from full URLs
- **Verification**: Preview category metadata before joining
- **Error Handling**: Invalid/expired code shows error message

## Import/Export Features

### Export Functionality

- **JSON Format**: Complete data export via `ImportExportModal`
- **Includes**: Links (with `direct_redirect`), categories, tags with relationships
- **Shared-category exclusion**: Links belonging to other users via shared categories are excluded from export; a toast notification reports the excluded count
- **Filename**: Timestamped export files

### Import Functionality

- **JSON Upload**: Import from exported data
- **Validation**: Comprehensive data validation
- **Duplicate Handling**: Smart duplicate detection
- **Progress Tracking**: Real-time import progress overlay (Teleport)
- **Default Color**: Imported categories without color get `#687061`
- **Statistics**: Show import results summary
- **Confirmation Modal**: Styled modal replaces `window.confirm()` before executing import
- **`direct_redirect`**: Exported and imported for each link

### Supported Data

```json
{
  "links": [...],
  "categories": [...],
  "tags": [...]
}
```

## Theming & Customization

### Theme System

- **Light Theme**: Default bright appearance
- **Dark Theme**: Dark mode with Tailwind `dark:` variant classes
- **Auto-detection**: Respects system preferences via `@vueuse/core` `useDark()`
- **Persistence**: Stored in localStorage under `hiddenshelf_theme` key
- **Toggle**: `useTheme()` composable provides `isDark` ref and `toggleTheme()` function
- **Dashboard toggle**: Theme section in Dashboard view with sun/moon icon button and mode label

### Brand Color System

- **Custom brand color**: Stored in user settings via `settingsApi`
- **Color Generation**: `applyBrandColor(hex)` in app store generates 11 CSS custom properties (`--brand-50` through `--brand-950`)
- **Algorithm**: Clamp-based shade generation with offsets: +80, +60, +40, +25, +10, 0, -15, -30, -50, -65, -85
- **Reset Option**: Return to default colors
- **Live Preview**: Color changes apply immediately via CSS custom properties

### Visual Design

- **Icons**: MDI (Material Design Icons) throughout — `<i class="mdi mdi-*">`
- **Typography**: Tailwind default font stack
- **Animations**: Smooth transitions (category collapse, danger zone expand/collapse via `<transition>`)
- **Modals**: All use Teleport to body with backdrop overlay

## Database Schema

### Core Tables

#### Users

- `id`, `email` (unique), `created_at`

#### Links

- `id`, `user_id`, `hash` (public identifier), `url`, `title`, `description`, `icon`, `display_order`, `is_public`, `direct_redirect`, `category_id`, `metadata` (JSON), `created_at`, `updated_at`

#### Categories

- `id`, `user_id`, `name`, `icon`, `color`, `direct_redirect_default`, `created_at`

#### Tags

- `id`, `user_id`, `name`, `created_at`

#### Link_Tags (Many-to-Many)

- `link_id`, `tag_id`

#### Category_Shares

- `id`, `category_id`, `share_code`, `created_by`, `expires_at`, `created_at`

#### Category_Share_Members

- `id`, `category_id`, `user_id`, `accepted_at`

#### Link_Visits

- `id`, `link_id`, `visited_at`, `ip_masked`, `user_agent`, `browser`, `os`, `referer`

#### Magic_Tokens

- `id`, `email`, `token`, `expires_at`, `used`, `created_at`

#### User_Settings

- `id`, `user_id`, `settings` (JSON)

### Migration System

- Sequential SQL files in `db/migrations/` (001 through 006)
- Automatic execution on first access
- Version tracking in `_meta` table

## API Endpoints

### Authentication (`/api/auth/*`)

- `POST /api/auth/login` — Send magic link
- `GET /api/auth/verify?token=X` — Verify and login
- `GET /api/auth/me` — Current user info
- `POST /api/auth/logout` — Logout
- `GET /api/auth/google` — Initiate Google OAuth
- `GET /api/auth/google/callback` — Google OAuth callback

### Links (`/api/links`)

- `GET` — List links (pagination, search, category filter, `include_shared`) — each link includes `total_visits` (batch-fetched, no N+1)
- `POST` — Create link
- `GET ?id=X` — Get specific link
- `PUT ?id=X` — Update link
- `DELETE ?id=X` — Delete link
- `GET ?hash=X` — Get public link by hash

### Categories (`/api/categories`)

- `GET` — List categories (with link_count, is_shared, member_count)
- `POST` — Create category
- `PUT ?id=X` — Update category
- `DELETE ?id=X` — Delete category

### Tags (`/api/tags`)

- `GET` — List tags (with usage_count)
- `POST` — Create tag
- `DELETE ?id=X` — Delete tag

### Category Shares (`/api/category_shares`)

- `GET ?category_id=X` — Get share info
- `POST` — Create share or accept invitation
- `DELETE ?category_id=X` — Remove sharing
- `DELETE ?category_id=X&member_id=Y` — Remove member
- `GET ?code=X` — Verify share code (returns preview)
- `GET` — List shared categories

### Link Visits (`/api/link_visits`)

- `POST` — Log link visit (public, no auth)
- `GET ?link_id=X` — Get visit statistics
- `GET` — Get visit summary for all links

### User Settings (`/api/user_settings`)

- `GET` — Get user settings
- `PUT` — Update user settings (links_per_page, brand_color)

### Configuration (`/api/config`)

- `GET` — Get public app config (version, site name, features)

## Public Link Viewing

### View Interface (`public/view.html` — Alpine.js, not yet migrated)

- **Link Preview**: Display link metadata before redirect
- **Direct Redirect**: Optional immediate redirect (800ms delay)
- **Cancellable Redirect**: Overlay shows "stay on page" link to cancel redirect timer
- **`?stay` URL Parameter**: Adding `&stay` prevents direct redirect, always shows preview
- **Visit Logging**: Track access via `/api/link_visits`
- **Error Handling**: Invalid/private link messages
- **Mobile Optimized**: Responsive design

### URL Routing

- **Short URLs**: `/h/{hash}` format via Hono route handler
- **Full URLs**: `/public/view.html?hash={hash}`
- **Stay Parameter**: `/public/view.html?hash={hash}&stay`

## Security Features

### Data Protection

- **SQL Injection Prevention**: Prepared statements throughout
- **XSS Protection**: Output escaping
- **CSRF Protection**: Token validation on state-changing operations
- **Session Security**: Secure session configuration
- **Input Length Validation**: All user inputs enforced against `MAX_LENGTHS` constants (`helpers.js`):
  - URL: 2048 chars, Title: 255, Description: 5000, Icon: 100, Category name: 100, Tag name: 50, Email: 254
  - Enforced in `links.js` (POST/PUT), `categories.js` (POST/PUT), `tags.js` (POST)
- **URL Protocol Whitelist**: `isValidUrl()` only accepts `http:` and `https:` protocols — rejects `javascript:`, `data:`, `vbscript:`, etc.

### Privacy Features

- **IP Masking**: Partial masking for visit logs
- **Email Security**: Cryptographically secure token generation
- **Data Isolation**: User-scoped data access
- **Private by Default**: Links private unless explicitly made public

### Authentication Security

- **One-time Tokens**: Magic links expire after single use (15 minutes)
- **Secure Generation**: `crypto.randomBytes()`-based token generation
- **Session Timeout**: 30-day session lifetime
- **Rate Limiting**: In-memory rate limiter on POST `/api/auth/login` — 10 attempts per IP per 15-minute window, returns HTTP 429 when exceeded. Uses `getClientIp()` helper with `X-Forwarded-For` support. Limiter state stored in `loginAttempts` Map (exported for test cleanup).

### Open Redirect Prevention

- **`redirect_origin` validation**: All `redirect_origin` parameters in magic link login (POST), verify (GET), and Google OAuth (GET `/google`, GET `/google/callback`) are validated via `isAllowedRedirectOrigin()`:
  - Allows origins matching `config.siteUrl` hostname
  - Allows `localhost` and `127.0.0.1` (dev servers)
  - Rejects all other origins (set to `null`)
- **Location**: `backend/src/lib/helpers.js` (`isAllowedRedirectOrigin`), enforced in `backend/src/routes/auth.js`

### CORS Configuration

- **Dynamic Origin Handler**: Replaced `origin: "*"` with a function-based handler in `index.js`:
  - Allows requests from the same hostname as `config.siteUrl`
  - Allows `localhost` / `127.0.0.1` origins (for dev)
  - Returns `null` (disallow) for all other origins
  - Works properly with `credentials: true`

### Session Cookie Security

- **HttpOnly**: Session cookies set with `HttpOnly` flag (prevents JavaScript access)
- **SameSite=Lax**: Prevents cross-site request forgery
- **Secure flag (production)**: Automatically adds `Secure` flag when `config.siteUrl` does not contain `localhost` or `127.0.0.1` — ensures cookies are only sent over HTTPS in production
- **Location**: `backend/src/middleware/session.js`

### Code Quality Improvements (Senior Review)

- **Migration Failure Handling**: `database.js` now throws on migration failure instead of silently swallowing errors — prevents running against a broken schema
- **N+1 Query Fixes**:
  - `links.js` list endpoint: Replaced per-link `getTagsForLink()` loop with batch `SELECT ... WHERE lt.link_id IN (...)` query using a `Map` to group tags by link_id
  - `shares.js` shared categories: Replaced per-category `SELECT COUNT(*)` loop with single batch query grouped by `category_id`
- **Category Data Integrity**:
  - Update endpoint now sets `updated_at = CURRENT_TIMESTAMP` (new migration `007_category_updated_at.sql`)
  - Delete endpoint nullifies orphaned links (`UPDATE links SET category_id = NULL WHERE category_id = ?`) before deleting
- **Category Ownership Validation**: `links.js` POST and PUT endpoints validate that `categoryId` belongs to the authenticated user — prevents cross-user category assignment
- **Bulk Delete Endpoint**: New `DELETE /api/account/data` in `account.js` — wraps all deletions (link_tags, link_visits, links, tags, category shares, categories) in a single SQLite transaction. Replaced sequential HTTP requests in `ProfileView.vue` with single API call via `accountApi.js`
- **BaseModal Accessibility**: Added `role="dialog"`, `aria-modal="true"`, `aria-label`, Escape key handler, auto-focus on open, and cleanup on unmount
- **Timer Leak Fix**: `EditLinksView.vue` now clears search debounce timeout on unmount via `onUnmounted`
- **Short URL Hash Validation**: `/h/:hash` route validates hash with `/^[a-zA-Z0-9]{1,20}$/` before DB lookup — rejects XSS payloads and overlong input
- **Import Order Fix**: `helpers.js` moved config import to top of file (was a late import at bottom)

### Debug Mode

- **Default off**: `debugMode` defaults to `false` when `DEBUG_MODE` env var is unset (previously defaulted to `true`)
- Prevents accidental exposure of error details and magic link URLs in production
- Dev environments set `DEBUG_MODE=true` explicitly in `docker-compose.yml`

## Configuration

### Environment Variables

- All configuration via environment variables (see `backend/src/config.js`)
- Database SQLite file path (`DB_PATH`)
- Site URL, name, branding (`SITE_URL`, `SITE_NAME`)
- Email/SMTP settings for magic links (`SMTP_HOST`, `SMTP_PORT`, etc.)
- Session secret and lifetime (`SESSION_SECRET`, `SESSION_LIFETIME`)
- Debug mode, signup toggle (`DEBUG_MODE`, `SIGNUP_ENABLED`)
- Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)

### User Settings (stored in DB)

- **Links Per Page**: Configurable pagination (10-100)
- **Brand Color**: Custom theme color hex

### Docker Configuration

- **`make dev`**: Start backend + Vue HMR dev server
- **`make build-frontend`**: Production build
- **`make test-frontend`**: Run tests in container
- **HMR**: `CHOKIDAR_USEPOLLING=true` for Docker file watching
- **Profiles**: dev, build, test in `docker-compose.yml`

### Environment Variables

- `VITE_API_PROXY_TARGET` — API proxy target (default: `http://localhost:3000`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- See `docker-compose.yml` for full list

## Testing

### Framework

- **Vitest 1.6** with `globals: true` (no imports needed for `describe`, `expect`, etc.)
- **@vue/test-utils** for mounting Vue components
- **jsdom** environment for DOM simulation
- **Setup file**: `src/test/setup.js` — `vi.restoreAllMocks()` in `afterEach`

### Test Files & Coverage

| File                                            | Tests | Covers                                                                                                                      |
| ----------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `stores/toast.test.js`                          | 7     | Toast push/remove, auto-dismiss timing, unique IDs, duration/createdAt                                                      |
| `stores/auth.test.js`                           | 3     | Auth store login/logout/session                                                                                             |
| `lib/httpClient.test.js`                        | 2     | HTTP client request/error handling                                                                                          |
| `components/feedback/ToastList.test.js`         | 7     | Rendering, CSS classes per type, progress bar animation, click dismiss                                                      |
| `components/links/LinkCardEdit.test.js`         | 13    | Public/private emoji (🔓/🔒), copy URL, delete, tag pills, description fallback, direct_redirect badge, visit count display |
| `components/categories/CategoryManager.test.js` | 8     | Category list, link counts, create/delete, shared-with-me section, leave buttons                                            |
| `views/DashboardView.test.js`                   | 12    | Welcome message, clickable stat cards, totalCategories with shared, visit stats, quick actions, navigation, theme toggle    |
| `views/ViewLinksView.test.js`                   | 9     | X of Y counter, category headers, collapse/expand, empty state, Load More, shared owner badge                               |
| `views/EditLinksView.test.js`                   | 10    | Search (debounced 300ms), category filter (immediate), pagination, empty state, link cards                                  |
| `views/ProfileView.test.js`                     | 13    | Beta notice, email, app version, share code verify/preview, URL extraction, danger zone, delete modal, shared categories    |
| `views/LoginView.test.js`                       | 8     | Share code sessionStorage persistence, auth redirect, email input, remembered email display, welcome back UX with user icon |

**Frontend Total: 92 tests across 11 files**

### Backend Test Files & Coverage

| File                        | Tests | Covers                                                                                                                                                              |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/auth.test.js`        | 13    | Magic link login, verify, logout, session, Google OAuth flow                                                                                                        |
| `tests/links.test.js`       | 23    | Link CRUD, pagination, category filtering, tag filtering, total_visits batch fetch                                                                                  |
| `tests/categories.test.js`  | 10    | Category CRUD, ordering, user isolation                                                                                                                             |
| `tests/tags.test.js`        | 8     | Tag CRUD, user isolation                                                                                                                                            |
| `tests/shares.test.js`      | 12    | Share create/join/leave, member management, shared data access                                                                                                      |
| `tests/linkVisits.test.js`  | 8     | Visit tracking, IP masking, public link access                                                                                                                      |
| `tests/settings.test.js`    | 7     | User settings CRUD, brand color, links per page                                                                                                                     |
| `tests/config.test.js`      | 1     | Public app config endpoint                                                                                                                                          |
| `tests/security.test.js`    | 22    | Open redirect prevention, input validation (length + protocol), rate limiting, debug mode, session cookies, CORS, XSS                                               |
| `tests/codeQuality.test.js` | 11    | Category delete orphans, category ownership validation, batch tag fetching, bulk delete (transaction + isolation + auth), short URL validation, category updated_at |
| `tests/migrations.test.js`  | 14    | All 7 migrations run successfully, idempotency, per-migration schema checks, foreign key constraints, cascade behavior                                              |

**Backend Total: 129 tests across 11 files**

**Combined Total: 221 tests (92 frontend + 129 backend)**

### Testing Patterns

- **Store tests**: `createPinia()` + `setActivePinia()` per test
- **Component tests**: `mount()` with `global: { plugins: [pinia], stubs: { Teleport: true } }`
- **API mocking**: `vi.mock("@/services/api/xxxApi")` at module level
- **Child component stubs**: Stub heavy children with simple templates to isolate tests
- **Timer testing**: `vi.useFakeTimers()` + `vi.advanceTimersByTime()` for debounce/auto-dismiss
- **Router mocking**: `vi.mock("vue-router")` with controlled `useRoute()`/`useRouter()` returns

### Migration Testing

**All database migrations are tested before spinning up the app.** This catches schema errors early and ensures production deployments are safe.

- **Location**: `backend/tests/migrations.test.js` (14 tests)
- **Coverage**:
  - All 7 migrations run successfully on a fresh database
  - Idempotency (migrations can be re-run safely)
  - Per-migration schema verification (tables, columns, indexes)
  - Foreign key constraints enforced
  - Cascade delete behavior verified
- **Run tests**: `cd backend && npm test tests/migrations.test.js`
- **Why this matters**: Prevents migration failures like "Cannot add a column with non-constant default" or "duplicate column name" in production

## UI/UX Features

### Interaction Patterns

- **Long Press**: Mobile context menu for link cards
- **Keyboard Navigation**: Accessible interactions
- **Toast Notifications**: Success/error/info feedback with progress bar and auto-dismiss (3500ms)
- **Modal System**: Teleported overlays for forms and confirmations
- **Delete Confirmations**: All destructive actions use styled confirmation modals (never `window.confirm()`)
- **Icon Auto-Prefix**: `LinkFormModal` auto-prepends `mdi-` when user omits it with live preview
- **Danger Zone Animation**: Smooth `<transition>` expand/collapse

### Responsive Design

- Mobile-first with Tailwind breakpoints
- Touch-friendly interface (long-press context menus)
- Full desktop feature access

### State Management (Pinia)

- **`app.js` store**: Links, categories, tags, pagination, search/filter state, `loadLinks()`, `loadMore()`, `bootstrap()`, `checkPendingShare()`, `applyBrandColor()`, `loadAppConfig()`
- **`auth.js` store**: User session, `isAuthenticated`, login/logout
- **`toast.js` store**: Toast items array, `push()`, `remove()`, auto-dismiss with `setTimeout(3500ms)`, each item has `{ id, type, message, duration, createdAt }`

### API Service Layer

- One file per resource: `authApi.js`, `linksApi.js`, `categoriesApi.js`, `tagsApi.js`, `sharesApi.js`, `settingsApi.js`, `configApi.js`, `accountApi.js`
- All use shared `httpClient.js` (fetch wrapper with error handling)
- Export named object with methods (not default export)
- Return data directly; errors are thrown
