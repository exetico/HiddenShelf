# Hidden Shelf

A minimal, flexible link-saving solution with public/private sharing capabilities.

## Quick Start

```bash
# Start the app with Docker
make dev                    # Backend + Vue dev server (HMR)
# or
make up && make build-frontend  # Backend + production build

# Access at http://localhost:3000
# Dev server at http://localhost:5173 (when using make dev)
```

## Features

- 🔗 Save and organize links with metadata
- 📂 Organize with categories and tags
- 🤝 Share entire categories with other users
- 🔒 Public/private link sharing (unique hash URLs)
- 📊 Link visit tracking and analytics
- ✉️ Passwordless authentication via magic links
- 🔐 Google OAuth/SSO login
- 🎨 Dark/light theme with custom branding
- 📱 Responsive, mobile-first design
- 💾 SQLite database (zero configuration)
- 📤 Import/Export your data (JSON)
- ✅ Tested with Vitest + Testing Library (frontend + backend)

## Tech Stack

- **Backend:** Node.js + Hono + better-sqlite3
- **Database:** SQLite 3
- **Frontend:** Vue 3 + Vite + Tailwind CSS
- **State Management:** Pinia
- **Routing:** Vue Router (hash-based)
- **Testing:** Vitest + Testing Library
- **Auth:** Magic link (one-time tokens via email) + Google OAuth

## Project Structure

```
Hidden Shelf/
├── backend/                # Hono.js backend
│   ├── src/
│   │   ├── index.js       # Server entry point
│   │   ├── config.js      # Configuration (env vars)
│   │   ├── lib/
│   │   │   ├── database.js# SQLite wrapper + migrations
│   │   │   ├── helpers.js # Utility functions
│   │   │   └── mailer.js  # Email sending (nodemailer)
│   │   ├── middleware/
│   │   │   ├── auth.js    # requireAuth / optionalAuth
│   │   │   └── session.js # Cookie-based sessions
│   │   └── routes/
│   │       ├── auth.js    # Login, verify, logout, me, Google OAuth
│   │       ├── links.js   # CRUD for links
│   │       ├── categories.js # Categories management
│   │       ├── tags.js    # Tags management
│   │       ├── shares.js  # Category sharing
│   │       ├── settings.js# User preferences
│   │       ├── linkVisits.js # Visit tracking
│   │       └── config.js  # Public app config
│   ├── tests/             # Backend tests (Vitest)
│   └── package.json
├── frontend/              # Vue 3 application
│   ├── src/
│   │   ├── main.js        # App entry point
│   │   ├── App.vue        # Root component
│   │   ├── router/        # Vue Router configuration
│   │   ├── stores/        # Pinia state management
│   │   │   ├── auth.js    # Authentication state
│   │   │   ├── app.js     # App-wide state
│   │   │   └── toast.js   # Notifications
│   │   ├── services/      # API abstraction layer
│   │   │   └── api/       # Backend API clients
│   │   ├── components/    # Reusable Vue components
│   │   │   ├── layout/    # App shell, navigation
│   │   │   ├── links/     # Link cards, forms
│   │   │   ├── categories/# Category management
│   │   │   ├── tags/      # Tag management
│   │   │   ├── common/    # Modals, buttons
│   │   │   └── feedback/  # Toasts, alerts
│   │   ├── views/         # Route views
│   │   └── composables/   # Reusable logic (e.g., useTheme)
│   ├── index.html         # Vite entry point
│   ├── package.json
│   ├── vite.config.js     # Vite + dev proxy config
│   └── vitest.config.js   # Test configuration
├── db/                    # Database
│   ├── database.sqlite    # SQLite database file
│   └── migrations/        # Schema migrations (SQL)
├── public/                # Static files
│   ├── app/               # Built Vue app (output)
│   └── view.html          # Public link viewer
├── docker-compose.yml     # Docker services
├── Dockerfile             # Node.js container
└── Makefile               # Convenience commands
```

## Database Schema

### Users

- `id` - Primary key
- `email` - Unique email
- `created_at` - Timestamp
- `oauth_provider` - OAuth provider (e.g., `google`) — nullable
- `oauth_id` - OAuth provider user ID — nullable
- `oauth_email` - Email returned by OAuth provider — nullable

### User_Settings

- `user_id` - Primary key (FK → users, cascades on delete)
- `settings` - JSON string (`{ links_per_page, brand_color }`)
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Links

- `id` - Primary key
- `user_id` - Foreign key to users (cascades on delete)
- `hash` - Unique public identifier (e.g., `abc123xyz`)
- `url` - The actual link URL
- `title` - Link title
- `description` - Optional description
- `icon` - MDI icon name (e.g., `mdi-github`) — nullable
- `display_order` - Manual sort position — nullable
- `is_public` - Boolean (0 = private, 1 = public)
- `metadata` - JSON for flexible extra data
- `direct_redirect` - Boolean (0 = show preview, 1 = redirect immediately)
- `category_id` - Foreign key to categories (set to NULL on category delete) — nullable
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Tags

- `id` - Primary key
- `name` - Tag name (unique per user)
- `user_id` - Foreign key to users (cascades on delete)
- `created_at` - Timestamp

### Link_Tags (Many-to-many)

- `link_id` - Foreign key to links (cascades on delete)
- `tag_id` - Foreign key to tags (cascades on delete)

### Categories

- `id` - Primary key
- `user_id` - Foreign key to users (cascades on delete)
- `name` - Category name
- `icon` - MDI icon name — nullable
- `color` - Hex color string — nullable
- `direct_redirect_default` - Default `direct_redirect` value for new links in this category (0/1)
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Magic_Tokens

- `id` - Primary key
- `email` - Email address
- `token` - One-time token (unique)
- `expires_at` - Expiration timestamp
- `used` - Boolean
- `redirect_origin` - Allowed origin for post-verify redirect (supports dev vs prod port differences) — nullable
- `created_at` - Timestamp

### Category_Shares

- `id` - Primary key
- `category_id` - Foreign key to categories (cascades on delete)
- `share_code` - Unique invite code
- `created_by` - Foreign key to users (cascades on delete)
- `created_at` - Timestamp
- `expires_at` - Expiration timestamp — nullable

### Category_Share_Members

- `id` - Primary key
- `category_id` - Foreign key to categories (cascades on delete)
- `user_id` - Foreign key to users (cascades on delete)
- `accepted_at` - Timestamp

### Link_Visits

- `id` - Primary key
- `link_id` - Foreign key to links (cascades on delete)
- `visited_at` - Timestamp
- `ip_masked` - Partially masked IP address
- `user_agent` - Raw browser user-agent string
- `browser` - Parsed browser name
- `os` - Parsed OS name
- `referer` - Referring URL

## API Endpoints

### Authentication

- `POST /api/auth/login` - Send magic link
- `GET /api/auth/verify?token=xxx` - Verify token and login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback

### Links

- `GET /api/links` - List user's links (with search, pagination, category filter)
- `POST /api/links` - Create new link
- `GET /api/links?id=123` - Get single link
- `PUT /api/links?id=123` - Update link
- `DELETE /api/links?id=123` - Delete link
- `GET /api/links?hash=abc123` - Get public link by hash (no auth)

### Categories

- `GET /api/categories` - List categories (with link_count, is_shared, member_count)
- `POST /api/categories` - Create category
- `PUT /api/categories?id=123` - Update category
- `DELETE /api/categories?id=123` - Delete category

### Tags

- `GET /api/tags` - List tags (with usage_count)
- `POST /api/tags` - Create tag
- `DELETE /api/tags?id=123` - Delete tag

### Category Sharing

- `GET /api/category_shares?code=xxx` - Verify share code (public)
- `GET /api/category_shares?category_id=123` - Get share info and members
- `GET /api/category_shares` - List categories shared with me
- `POST /api/category_shares` - Create share code or accept share
- `DELETE /api/category_shares?category_id=123` - Remove sharing or leave

### User Settings

- `GET /api/user_settings` - Get user settings
- `PUT /api/user_settings` - Update settings (links_per_page, brand_color)

### Link Visits

- `POST /api/link_visits` - Log visit (public, no auth)
- `GET /api/link_visits?link_id=123` - Get link stats
- `GET /api/link_visits` - Get visit summary for all links

### Config

- `GET /api/config` - Public app config (version, site name, features)

### Account

- `DELETE /api/account/data` - Delete all user data (links, tags, categories, shares) in a single transaction

## Installation

### Option 1: Docker (Recommended)

1. **Start the app**

   ```bash
   docker compose up -d --build web
````

2. **Choose frontend workflow**
   - **Vue dev server (HMR, proxied API):**

     ```bash
     docker compose --profile dev up --build web frontend
     ```

     Open: http://localhost:5173

   - **One-off production frontend build (outputs to `public/app`):**

     ```bash
     docker compose --profile build run --rm frontend-build
     ```

     Then open the built app: http://localhost:3000

   - **Run tests in Docker:**

     ```bash
     docker compose --profile test run --rm frontend-test
     docker compose --profile test run --rm backend-test
     ```

3. **Access the app**

   After starting services, access the app at:
   - **Root:** http://localhost:3000/ (auto-redirects to Vue app)
   - **Vue App:** http://localhost:3000/public/app/index.html
   - **Vue Dev Server (HMR):** http://localhost:5173 (when using `make dev`)

   **Routes in the Vue app:**
   - `#/login` - Login page (magic link or Google OAuth)
   - `#/dashboard` - Dashboard with stats
   - `#/view` - View your links
   - `#/edit` - Edit and organize links
   - `#/profile` - User settings and preferences

   **Important notes:**
   - Database migrations run automatically on first start
   - Magic links are logged to console in debug mode:
     ```bash
     docker compose logs -f web
     ```
   - The app uses hash-based routing (`#/route`) to avoid server-side routing conflicts

4. **Useful lifecycle commands**

   ```bash
   docker compose down
   docker compose down -v
   docker compose logs -f web
   ```

#### Quick Commands (Using Makefile)

**Development:**

```bash
make dev             # Start backend + Vue dev server (port 5173)
                     # Live reload, HMR enabled
```

**Production Build:**

```bash
make up              # Start backend only
make build-frontend  # Build Vue app → public/app/
                     # Access at http://localhost:3000
```

**Testing:**

```bash
make test-frontend   # Run frontend tests in Docker
make test-backend    # Run backend tests in Docker
make test            # Run all tests
```

**Maintenance:**

```bash
make logs            # Follow backend logs (see magic links here)
make down            # Stop all services
make clean           # Stop and remove volumes (fresh start)
make install         # Install all deps locally (for IDE autocomplete)
make help            # Show all available commands
```

### Option 2: Manual Installation

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd Hidden Shelf
   ```

2. **Install dependencies**

   Requires Node.js v20 or higher:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install && npm run build
   ```

3. **Configure environment**

   Set environment variables (or accept defaults):

   ```bash
   export SITE_URL=https://yoursite.com
   export SMTP_HOST=smtp.example.com
   export SMTP_PORT=587
   export SMTP_USER=your@email.com
   export SMTP_PASS=password
   export SMTP_ENCRYPTION=tls
   export FROM_EMAIL=noreply@yoursite.com
   ```

   Or create a `.env` file — see `.env.example` for all options.

4. **Set permissions**

   ```bash
   chmod 755 db/
   ```

5. **Start the server**

   ```bash
   node backend/src/index.js
   ```

   The app runs on port 3000 by default. Database migrations run automatically on first start.

## Configuration

All configuration is via environment variables:

| Variable               | Default                               | Description                             |
| ---------------------- | ------------------------------------- | --------------------------------------- |
| `PORT`                 | `3000`                                | Server port                             |
| `DB_PATH`              | `./db/database.sqlite`                | SQLite database path                    |
| `SITE_URL`             | `http://localhost:3000`               | Public URL of the app                   |
| `BASE_PATH`            | ``                                    | Subpath for deployment (e.g., `/links`) |
| `SITE_NAME`            | `Hidden Shelf`                        | App display name                        |
| `SMTP_HOST`            | `mail.smtpbucket.com`                 | SMTP server                             |
| `SMTP_PORT`            | `8025`                                | SMTP port                               |
| `SMTP_USER`            | ``                                    | SMTP username                           |
| `SMTP_PASS`            | ``                                    | SMTP password                           |
| `SMTP_ENCRYPTION`      | ``                                    | `tls` or `ssl` or empty                 |
| `FROM_EMAIL`           | `noreply@example.com`                 | Sender email                            |
| `FROM_NAME`            | `Hidden Shelf`                        | Sender name                             |
| `DEBUG_MODE`           | `false`                               | Show detailed errors                    |
| `SIGNUP_ENABLED`       | `true`                                | Allow new user registration             |
| `SESSION_SECRET`       | `change-me-in-production`             | Session signing key                     |
| `GOOGLE_CLIENT_ID`     | ``                                    | Google OAuth client ID                  |
| `GOOGLE_CLIENT_SECRET` | ``                                    | Google OAuth client secret              |
| `GOOGLE_REDIRECT_URI`  | `{SITE_URL}/api/auth/google/callback` | OAuth redirect                          |

**Testing Email:**

Use a test SMTP server like [smtpbucket.com](https://www.smtpbucket.com/) — the default config points to it. Leave `SMTP_USER`, `SMTP_PASS`, and `SMTP_ENCRYPTION` empty.

### Deployment Configuration

#### Custom Domain

Set `SITE_URL` to your production domain:

```bash
export SITE_URL=https://links.example.com
```

#### Subpath Deployment

If deploying under a subpath (e.g., `example.com/links/`):

```bash
export BASE_PATH=/links
export SITE_URL=https://example.com
export VITE_BASE_PATH=/links
make build-frontend
```

- `BASE_PATH` should NOT have a trailing slash
- `BASE_PATH` should start with `/`
- Keep `BASE_PATH` empty for root deployments

## How It Works

### Authentication Flow

1. User enters email
2. System generates one-time token
3. Email sent with magic link
4. User clicks link, gets logged in
5. Session stored, token invalidated

### Public Link Sharing

- Each link gets a unique hash (e.g., `h/abc123xyz`)
- If marked public, anyone with the hash can view
- Private links only visible to owner
- Similar to YouTube unlisted videos
- **Direct Redirect:** Links can be configured to redirect immediately to the target URL
- **Redirect Overlay:** Shows a "Redirecting..." spinner with the target URL and a discrete "stay on page" link to cancel and view the full link details instead
- **`?stay` Parameter:** Append `&stay` to any public link URL (e.g., `?hash=abc123&stay`) to prevent direct redirect and always show the link preview page

### Link Organization

- **Categories:** Classify links (e.g., "Articles", "Videos")
- **Tags:** Flexible labeling (many-to-many)

## Development

### Backend Development (Hono.js)

The Hono.js backend is in the `backend/` directory.

**Local Development:**

```bash
cd backend
npm install
npm run dev        # Start with --watch (auto-restart on changes)
npm run test       # Run backend tests
npm run test:watch # Run tests in watch mode
```

**Architecture:**

- `src/index.js` — Entry point, mounts routes and middleware
- `src/config.js` — All configuration from environment variables
- `src/lib/database.js` — SQLite wrapper (better-sqlite3) with migration runner
- `src/lib/helpers.js` — Utility functions
- `src/lib/mailer.js` — Email sending (nodemailer)
- `src/middleware/session.js` — Cookie-based session management
- `src/middleware/auth.js` — Authentication guards
- `src/routes/*.js` — Route modules (one per resource)

### Frontend Development (Vue 3)

The Vue 3 frontend is in the `frontend/` directory.

**Local Development:**

```bash
cd frontend
npm install
npm run dev        # Start Vite dev server on :5173
npm run build      # Build for production
npm run test       # Run tests
npm run test:ui    # Run tests with UI
```

**Docker Development (recommended):**

```bash
make dev           # Start backend + Vue HMR server
make build-frontend# Build Vue app for production
make test          # Run all tests
```

**Hot Module Replacement (HMR):**
When running `make dev`, Vite provides instant hot module replacement.
The Docker setup includes `CHOKIDAR_USEPOLLING=true` for file watching in containers.

### Architecture Overview

**Backend Abstraction Layer:**
All API calls go through service modules in `frontend/src/services/api/` — no hardcoded API URLs in components.

**Component-Based Design:**

- `components/links/` - Link cards, forms, display
- `components/categories/` - Category management
- `components/layout/` - App shell, navigation
- `components/common/` - Reusable UI (modals, buttons)

**State Management:**

- `stores/auth.js` - Authentication state
- `stores/app.js` - Links, categories, tags
- `stores/toast.js` - Toast notifications

**Routing:**
Hash-based routing (`#/dashboard`, `#/edit`, etc.) to avoid server-side routing conflicts.

### Testing

**Frontend tests** (Vitest + Vue Testing Library):

```bash
cd frontend
npm run test              # Run all tests
npm run test:ui           # Interactive test UI
npm run test:coverage     # Coverage report
```

**Backend tests** (Vitest):

```bash
cd backend
npm run test              # Run all tests
npm run test:watch        # Watch mode
```

**All tests in Docker:**

```bash
make test                 # Frontend + backend tests
```

### Legacy Code

- `public/view.html` — Public link viewer (Alpine.js, still in use)

## Security Features

- SQL injection prevention (prepared statements)
- One-time magic tokens (expire after 15 minutes)
- Session-based authentication with secure cookies
- XSS prevention (output sanitization)
- OAuth state verification (CSRF protection for OAuth)

## Troubleshooting

### Magic Links Not Working

- Check console/Docker logs: `make logs`
- Magic links are logged in debug mode
- Verify SMTP environment variables
- Test with default smtpbucket.com config (no auth needed)

### HMR Not Working in Docker

- Ensure `CHOKIDAR_USEPOLLING=true` is set in `docker-compose.yml`
- Restart with: `docker compose down && make dev`
- Check if port 5173 is accessible

### Build Fails

```bash
# Clean and rebuild
make clean
make dev
```

### Google OAuth Not Working

- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` or `docker-compose.yml`
- Check redirect URI matches: `http://localhost:3000/api/auth/google/callback`
- See `GOOGLE_OAUTH_SETUP.md` for configuration instructions

### Tests Failing

```bash
cd frontend && npm run test     # Frontend test details
cd backend && npm run test      # Backend test details
```

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
