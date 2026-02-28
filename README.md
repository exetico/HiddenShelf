# Hidden Shelf

A minimal, flexible link-saving solution with public/private sharing capabilities.

## Quick Start

```bash
# Start the app with Docker
make dev                    # Backend + Vue dev server (HMR)
# or
make up && make build-frontend  # Backend + production build

# Access at http://localhost:8000
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
- ✅ Tested with Vitest + Testing Library

## Tech Stack

- **Backend:** PHP 8.x + PDO
- **Database:** SQLite 3
- **Frontend:** Vue 3 + Vite + Tailwind CSS (migrated from Alpine.js)
- **State Management:** Pinia
- **Routing:** Vue Router (hash-based)
- **Testing:** Vitest + Testing Library
- **Auth:** Magic link (one-time tokens via email) + Google OAuth

## Project Structure

```
Hidden Shelf/
├── api/                    # API endpoints (PHP)
│   ├── auth.php           # Authentication (login, verify)
│   ├── links.php          # CRUD operations for links
│   ├── categories.php     # Categories management
│   ├── tags.php           # Tags management
│   ├── category_shares.php# Sharing functionality
│   ├── user_settings.php  # User preferences
│   └── auth/              # OAuth handlers
│       ├── google.php     # Google OAuth initiation
│       └── google-callback.php
├── db/                    # Database
│   ├── database.sqlite    # SQLite database file
│   └── migrations/        # Schema migrations
├── frontend/              # Vue 3 application (NEW)
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
│   │   │   ├── LoginView.vue
│   │   │   ├── DashboardView.vue
│   │   │   ├── ViewLinksView.vue
│   │   │   ├── EditLinksView.vue
│   │   │   └── ProfileView.vue
│   │   ├── composables/   # Reusable logic (e.g., useTheme)
│   │   └── test/          # Test utilities
│   ├── index.html         # Vite entry point
│   ├── package.json       # Node dependencies
│   ├── vite.config.js     # Vite configuration
│   └── vitest.config.js   # Test configuration
├── public/                # Static files (served by PHP)
│   ├── app/               # Built Vue app (output)
│   ├── login.html         # Legacy Alpine.js login (deprecated)
│   ├── index.html         # Legacy Alpine.js app (deprecated)
│   └── view.html          # Public link viewer (still used)
├── lib/                   # Core PHP utilities
│   ├── Database.php       # Database wrapper + migrations
│   ├── Auth.php           # Authentication logic
│   ├── Mailer.php         # Email sending
│   └── helpers.php        # Utility functions
├── config.php             # Configuration
├── .htaccess              # URL rewriting + redirects
├── docker-compose.yml     # Docker services
├── Dockerfile             # PHP + Node container
└── Makefile               # Convenience commands
```

## Database Schema

### Users

- `id` - Primary key
- `email` - Unique email
- `created_at` - Timestamp

### Links

- `id` - Primary key
- `user_id` - Foreign key to users
- `hash` - Unique public identifier (e.g., "abc123xyz")
- `url` - The actual link
- `title` - Link title
- `description` - Optional description
- `is_public` - Boolean (0 = private, 1 = public)
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Tags

- `id` - Primary key
- `name` - Tag name (unique)

### Link_Tags (Many-to-many)

- `link_id` - Foreign key
- `tag_id` - Foreign key

### Categories

- `id` - Primary key
- `user_id` - Foreign key
- `name` - Category name
- `created_at` - Timestamp

### Magic_Tokens

- `id` - Primary key
- `email` - Email address
- `token` - One-time token
- `expires_at` - Expiration timestamp
- `used` - Boolean

## API Endpoints

### Authentication

- `POST /api/auth.php?action=login` - Send magic link
- `GET /api/auth.php?action=verify&token=xxx` - Verify token and login
- `POST /api/auth.php?action=logout` - Logout

### Links

- `GET /api/links.php` - List user's links
- `POST /api/links.php` - Create new link
- `GET /api/links.php?id=123` - Get single link
- `PUT /api/links.php?id=123` - Update link
- `DELETE /api/links.php?id=123` - Delete link
- `GET /api/links.php?hash=abc123` - Get public link by hash

### Tags

- `GET /api/tags.php` - List all tags
- `POST /api/tags.php` - Create tag

## Installation

### Option 1: Docker (Recommended)

1. **Core app (PHP + Apache)**

   ```bash
   docker compose up -d --build web
   ```

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

     Then open built app from PHP server: http://localhost:8000/public/app/index.html

   - **Run frontend test suite in Docker:**

     ```bash
     docker compose --profile test run --rm frontend-test
     ```

3. **Access the app**

   After starting services, access the app at:
   - **Root:** http://localhost:8000/ (auto-redirects to Vue app)
   - **Vue App:** http://localhost:8000/public/app/index.html
   - **Vue Dev Server (HMR):** http://localhost:5173 (when using `make dev`)
   - **Debug Page:** http://localhost:8000/public/debug.php (verify PHP setup)

   **Routes in the Vue app:**
   - `#/login` - Login page (magic link or Google OAuth)
   - `#/dashboard` - Dashboard with stats
   - `#/view` - View your links
   - `#/edit` - Edit and organize links
   - `#/profile` - User settings and preferences

   **Important notes:**
   - Database migrations run automatically on first load
   - Magic links are logged to Docker logs in dev mode:
     ```bash
     docker compose logs -f web
     ```
   - The app uses hash-based routing (`#/route`) to avoid PHP conflicts

4. **Useful lifecycle commands**

   ```bash
   docker compose down
   docker compose down -v
   docker compose logs -f web
   ```

#### Quick Commands (Using Makefile)

For convenience, use these shortcuts instead of full `docker compose` commands:

**Development:**

```bash
make dev             # Start backend + Vue dev server (port 5173)
                     # Live reload, HMR enabled
```

**Production Build:**

```bash
make up              # Start backend only
make build-frontend  # Build Vue app → public/app/
                     # Access at http://localhost:8000
```

**Testing:**

```bash
make test-frontend   # Run all Vue tests in Docker
```

**Maintenance:**

```bash
make logs            # Follow backend logs (see magic links here)
make down            # Stop all services
make clean           # Stop and remove volumes (fresh start)
make install         # Install frontend deps locally (for IDE autocomplete)
make help            # Show all available commands
```

**Typical Workflows:**

1. **Daily Development:**

   ```bash
   make dev           # Start everything, edit Vue files, see changes instantly
   ```

2. **Build for Production:**

   ```bash
   make build-frontend
   make up
   # Access at http://localhost:8000
   ```

3. **Test Changes:**
   ```bash
   make test-frontend  # Run tests
   make build-frontend # Build if tests pass
   ```

### Option 2: Manual Installation

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd Hidden Shelf
   ```

2. **Configure the app**
   - Copy `config.example.php` to `config.php`
   - Update email settings (SMTP)
   - Set your app URL

3. **Install dependencies and build CSS**

   Requires Node.js v20 or higher:

   ```bash
   npm install
   npm run build:css
   ```

4. **Set permissions**

   ```bash
   chmod 755 db/
   chmod 644 db/database.sqlite
   ```

5. **Point your web server to the project root**
   - Apache: Enable mod_rewrite
   - The `.htaccess` handles routing

6. **Access the app**
   - Navigate to your domain
   - Database migrations run automatically on first load

## Configuration

Edit `config.php`:

```php
define('DB_PATH', __DIR__ . '/db/database.sqlite');
define('SITE_URL', 'https://yoursite.com');

// Email settings
define('SMTP_HOST', 'smtp.example.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'your@email.com');
define('SMTP_PASS', 'password');
define('SMTP_ENCRYPTION', 'tls');
define('FROM_EMAIL', 'noreply@yoursite.com');
define('FROM_NAME', 'Hidden Shelf');
```

Testing Email: `UeNLqiPscLZ9ivgW@fP2LYAFme95rJ73p.com`

Use a test SMTP server like [this](https://www.smtpbucket.com/emails?recipient=UeNLqiPscLZ9ivgW@fP2LYAFme95rJ73p.com) if you need it. But remember to remove user, pass and encryption.

Like:

```php
define('SMTP_HOST', 'mail.smtpbucket.com');
define('SMTP_PORT', 8025); // Normally 587
// define('SMTP_USER', 'your@email.com');
// define('SMTP_PASS', 'your-password');
define('SMTP_ENCRYPTION', '');
```

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

### Link Organization

- **Categories:** Classify links (e.g., "Articles", "Videos")
- **Tags:** Flexible labeling (many-to-many)

## Development

### Frontend Development (Vue 3)

The new Vue 3 frontend is located in the `frontend/` directory.

**Local Development (without Docker):**

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
make test-frontend # Run tests in Docker
```

**Hot Module Replacement (HMR):**
When running `make dev`, Vite provides instant hot module replacement:

- Vue component changes reload without losing state
- CSS updates apply immediately
- Fast feedback loop for development

**File watching in Docker:**
The Docker setup includes `CHOKIDAR_USEPOLLING=true` to ensure file changes are detected inside containers.

### Architecture Overview

**Backend Abstraction Layer:**
All API calls go through service modules in `frontend/src/services/api/`:

- Makes it easy to swap PHP backend later
- Consistent error handling
- No hardcoded API URLs scattered in components

**Component-Based Design:**
Components are organized by feature:

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

Tests use Vitest + Vue Testing Library:

```bash
cd frontend
npm run test              # Run all tests
npm run test:ui           # Interactive test UI
npm run test:coverage     # Coverage report
```

**Test files:**

- `*.test.js` files alongside source code
- Test stores, components, and utilities
- Mock API calls and router

### Legacy Code

The old Alpine.js frontend files are deprecated but still present:

- `public/index.html` - Old main app (redirects to Vue app)
- `public/login.html` - Old login (kept for reference)
- `public/view.html` - Still used for public link viewing

### Technical Stack

**Backend:**

- Vanilla PHP with no framework dependencies
- Session-based auth
- PDO for database
- Composer for OAuth dependencies

**Frontend:**

- Vue 3 with Composition API
- Vite for build tooling
- Pinia for state management
- Vue Router for navigation
- Tailwind CSS for styling
- Vitest + Testing Library for tests

## Security Features

- CSRF protection on all POST/PUT/DELETE requests
- SQL injection prevention (prepared statements)
- One-time magic tokens (expire after 15 minutes)
- Session hijacking protection
- XSS prevention (output escaping)
- OAuth state verification (CSRF protection for OAuth)

## Migration from Alpine.js to Vue 3

The project was migrated from Alpine.js to Vue 3 for better maintainability and testing capabilities.

**What Changed:**

- Frontend framework: Alpine.js → Vue 3 + Vite
- State management: Inline Alpine data → Pinia stores
- Routing: Query params → Hash-based Vue Router
- Testing: None → Vitest + Testing Library
- Component structure: Single HTML file → Modular Vue components
- API calls: Inline fetch → Service layer abstraction

**What Stayed the Same:**

- Backend API endpoints (100% compatible)
- Database schema (no changes)
- Authentication flow
- All features preserved

**Legacy Files:**

- `public/index.html` - Old Alpine.js app (deprecated, redirects to Vue app)
- `public/login.html` - Old login page (deprecated, kept for reference)
- `public/view.html` - Public link viewer (still in use, not migrated)

**New File Structure:**

- `frontend/` - Complete Vue 3 application
- `public/app/` - Built Vue app (served by PHP)

## Troubleshooting

### Magic Links Not Working

- Check Docker logs: `make logs`
- Magic links appear in logs during dev mode
- Verify SMTP configuration in `config.php`
- Test SMTP with the provided test server setup

### HMR Not Working in Docker

- Ensure `CHOKIDAR_USEPOLLING=true` is set in `docker-compose.yml`
- Restart with: `docker compose down && make dev`
- Check if port 5173 is accessible

### Build Fails

```bash
# Clean and rebuild
make clean
docker compose down -v
make dev
```

### Google OAuth Not Working

- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` or `docker-compose.yml`
- Check redirect URI matches: `http://localhost:8000/api/auth/google-callback.php`
- See `GOOGLE_OAUTH_SETUP.md` for configuration instructions

### Tests Failing

```bash
cd frontend
npm run test       # See detailed errors
npm run test:ui    # Interactive debugging
```

### Old App Showing Instead of Vue App

- Clear browser cache
- Check `.htaccess` redirects
- Rebuild: `make build-frontend`
- Verify files exist in `public/app/`

## License

<TBD>
