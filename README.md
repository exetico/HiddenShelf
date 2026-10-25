# Hidden Shelf

A minimal, self-hosted place to save links, organise them with categories and tags, and share them, either one link at a time through a short public URL or a whole category with other users.

- 🔗 Save links with title, description, icon, category and tags
- 🔒 Private by default; make a link public to share it at `/h/<hash>`, optionally redirecting straight to the target
- 🤝 Share whole categories with other users
- 📊 Visit tracking for public links
- ✉️ Passwordless login with magic links, plus optional Google sign-in
- 🎨 Dark/light theme and your own brand color
- 📤 Import/export as JSON
- 💾 One SQLite file holds everything

## Run it in production (Docker)

This is the recommended way to run Hidden Shelf. You need a Linux server with **Docker** (with the `docker compose` plugin), **git** and **make**, a **domain name**, and either an **SMTP account** for the login emails or **Google sign-in** (see [Login without email](#login-without-email)).

### 1. Get the code

```bash
git clone https://github.com/exetico/HiddenShelf.git hiddenshelf
cd hiddenshelf
```

### 2. Configure it

All settings go in a `.env` file next to `docker-compose.yml`. It is not part of the repository, so updates never overwrite it.

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```bash
# Your public address, no trailing slash
SITE_URL=https://links.example.com
# Only reachable by a proxy on this machine. If the proxy runs on another
# machine, use the host port alone, e.g. 3000.
HOST_PORT=127.0.0.1:3000

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=your-password
# tls (port 587), ssl (port 465) or empty
SMTP_ENCRYPTION=tls
FROM_EMAIL=noreply@example.com
```

Keep comments in `.env` on their own lines. Some Docker Compose versions read `NAME=value # comment` as part of the value.

Leave `DEBUG_MODE=false`. The full list of settings is under [Configuration](#configuration). For Google sign-in, see [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md); leave `GOOGLE_REDIRECT_URI` empty and register `{SITE_URL}/api/auth/google/callback` in Google Cloud Console.

> If SMTP isn't set, login emails go to smtpbucket.com, a public test inbox anyone can read. The server prints a warning at startup when that happens on a non-localhost `SITE_URL`.

### 3. Start it

```bash
make up                  # same as: docker compose up -d --build web
```

This builds one image with the backend and the built frontend, and starts it in the background. It restarts with the server. The database is created in `db/` on the first start. Follow the log with `make logs`.

### 4. Put HTTPS in front

Logins need HTTPS: the session cookie is only sent over `https://` when `SITE_URL` isn't localhost. Any reverse proxy works. With [Caddy](https://caddyserver.com), which gets the certificate for you, the whole config is:

```
links.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

A proxy on the same machine or Docker network is trusted automatically for client IPs. If the proxy runs elsewhere or is a CDN, set `TRUST_PROXY=true`.

### 5. Log in

Open your `SITE_URL`, enter your email and click the link you receive (or use Google). The first login creates your account. When everyone who needs an account has one, set `SIGNUP_ENABLED=false` in `.env` and run `make up` again to close registration.

### Login without email

If you don't want to run SMTP, set up Google sign-in and add `EMAIL_LOGIN_ENABLED=false` to `.env`. The login page then only offers Google, no email is ever sent, and the `SMTP_*` settings are ignored. The server logs an error at startup if neither login method is available.

## Upgrading

```bash
make upgrade
```

This does three things:

1. Backs up the database to `db/backups/` (if the app is running).
2. Pulls the latest code with `git pull --ff-only`.
3. Rebuilds the image and restarts the container.

Database changes (migrations) run automatically when the new version starts, and older databases are upgraded in place.

**Why your data is safe:** the database is stored in the `db/` folder on the host and mounted into the container. It isn't inside the image or the container, and it isn't tracked by git. Rebuilding, `git pull`, `docker compose down` and `make clean` all leave it alone. The same goes for your `.env`.

To keep upgrades conflict-free, don't edit tracked files such as `docker-compose.yml`. Put settings in `.env`, and any other Compose change in a `docker-compose.override.yml` file, which Compose picks up automatically and git ignores. If `git pull` stops because a tracked file was changed, `git stash` your change, run `make upgrade` again, and move the change to `.env` or the override file.

To go back to an earlier version, check out its commit or tag and run `make up`. If the newer version changed the database, restore the backup made before the upgrade (see below).

## Your data

Everything Hidden Shelf stores is one SQLite database, `db/database.sqlite`, next to `docker-compose.yml`:

```yaml
volumes:
  - ./db:/app/db # host folder : container folder
```

- While the app runs you'll also see `database.sqlite-wal` and `-shm`. They are part of the database.
- **Another location:** create `docker-compose.override.yml` with

  ```yaml
  services:
    web:
      volumes:
        - /srv/hiddenshelf:/app/db
  ```

  and move the existing files there before starting.
- **Permissions:** the container runs as user `node` (uid 1000), so the folder must be writable by uid 1000. If the app fails with `unable to open database file`, run `sudo chown -R 1000:1000 db`.
- **Back up / get the data out:** `make backup` writes a consistent copy to `db/backups/hiddenshelf-<date>.sqlite`. It works while the app runs, and also when it's stopped. Add `OUT=` to also copy it somewhere else, e.g. `make backup OUT=~/hiddenshelf.sqlite`, then fetch it with `scp server:~/hiddenshelf.sqlite .`. For daily backups, run `cd /path/to/hiddenshelf && make backup` from cron and copy `db/backups/` off the server. Copying `database.sqlite` by hand while the app runs can miss recent writes.
- **Restore:** `make restore FILE=db/backups/hiddenshelf-<date>.sqlite`. It backs up the current database first, stops the app, swaps the file in and starts the app again. The file must be inside `db/`. Older backups are migrated automatically.
- **Per user:** everyone can also export their own links and categories as JSON from the app (Dashboard → Import Data).
- **Look inside:** `docker compose exec web sqlite3 /app/db/database.sqlite`, or open the file in any SQLite browser.

## Configuration

Set these in `.env`. Docker Compose passes them to the container. When running Node directly, start it with `node --env-file=.env backend/src/index.js`.

| Variable               | Default                               | Description                             |
| ---------------------- | ------------------------------------- | --------------------------------------- |
| `PORT`                 | `3000`                                | Server port (inside the container)      |
| `HOST_PORT`            | `3000`                                | Docker: port published on the host, e.g. `127.0.0.1:3000` |
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
| `DEBUG_MODE`           | `false`                               | Log magic links instead of emailing them, show detailed errors. Dev only |
| `SIGNUP_ENABLED`       | `true`                                | Allow new user registration             |
| `EMAIL_LOGIN_ENABLED`  | `true`                                | `false`: no magic link login and no email at all; Google sign-in only |
| `TRUST_PROXY`          | (auto)                                | `true`/`false`: trust `X-Forwarded-For` for client IPs. Auto trusts it only from private addresses |
| `GOOGLE_CLIENT_ID`     | ``                                    | Google OAuth client ID                  |
| `GOOGLE_CLIENT_SECRET` | ``                                    | Google OAuth client secret              |
| `GOOGLE_REDIRECT_URI`  | `{SITE_URL}/api/auth/google/callback` | OAuth redirect. Leave empty; the server warns if it doesn't end in `/api/auth/google/callback` |

### Subpath deployment

To serve the app under a path like `example.com/links/`, set `BASE_PATH=/links` and build the frontend with `VITE_BASE_PATH=/links`. The Docker image builds the frontend for the root path, so with Docker it's simpler to use a subdomain such as `links.example.com`.

## How it works

### Authentication Flow

1. User enters email
2. System generates one-time token
3. Email sent with magic link
4. User clicks link, gets logged in
5. Session stored, token invalidated

### Public Link Sharing

- Each link gets a unique hash. Public links are shared as `/h/<hash>`; private links are only visible to their owner (and to members of a shared category).
- `/h/<hash>` shows a small page with the link's title, description, URL and tags. The page's title and preview tags are filled in on the server, so chat apps and social sites show a proper preview.
- **Direct redirect:** a link can instead send visitors straight to its URL. Add `?stay` (`/h/<hash>?stay`) to see the page anyway.
- Visits are counted both on the page and on direct redirects.
- Older `/public/view.html?hash=<hash>` URLs still work and redirect to `/h/<hash>`.

### Link Organization

- **Categories:** Classify links (e.g., "Articles", "Videos")
- **Tags:** Flexible labeling (many-to-many)

## Development

```bash
make dev             # Backend on :3000 + Vite dev server with HMR on :5173
make test            # Frontend + backend tests in Docker
make help            # All commands
```

Open http://localhost:5173. `make dev` turns on debug mode, so magic links are printed in the terminal instead of emailed. The public link page is at http://localhost:5173/link.html?hash=<hash> on the dev server; `/h/<hash>` serves the last production build of it.

Without Docker you need Node.js 22:

```bash
cd backend && npm install && npm run dev       # API on :3000, restarts on changes
cd frontend && npm install && npm run dev      # Vite on :5173, proxies /api to :3000
```

### Tech Stack

- **Backend:** Node.js + Hono + better-sqlite3
- **Database:** SQLite 3
- **Frontend:** Vue 3 + Vite + Tailwind CSS, Pinia, Vue Router (hash-based)
- **Testing:** Vitest + Testing Library
- **Auth:** Magic link (one-time tokens via email) + Google OAuth

### Project Structure

```
hiddenshelf/
├── backend/                # Hono backend
│   ├── src/
│   │   ├── index.js        # Server entry point
│   │   ├── config.js       # Configuration (env vars)
│   │   ├── lib/            # Database + migrations runner, helpers, mailer
│   │   ├── middleware/     # Sessions, auth guards
│   │   └── routes/         # One module per resource; publicLink.js serves /h/:hash
│   ├── migrations/         # Schema migrations (SQL), applied on start
│   └── tests/              # Backend tests (Vitest)
├── frontend/               # Vue 3 application
│   ├── index.html          # The app
│   ├── link.html           # The public link page (/h/:hash)
│   └── src/
│       ├── main.js         # App entry
│       ├── link/           # Public link page entry and component
│       ├── router/, stores/, services/api/, components/, views/, composables/
│       └── styles.css      # Tailwind
├── db/                     # Your data (not in git), see "Your data"
├── public/
│   └── app/                # Built frontend (output)
├── docker-compose.yml
├── Dockerfile
└── Makefile
```

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
npm run build      # Build the app and the link page into public/app/
npm run test       # Run tests
npm run test:ui    # Run tests with UI
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
# Rebuild from scratch (your db/ folder is kept)
make clean
make up
```

### `unable to open database file`

The container runs as uid 1000 and can't write to `db/`. Fix the owner: `sudo chown -R 1000:1000 db`.

### Google OAuth Not Working

- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- The redirect URI registered in Google Cloud Console must be exactly `{SITE_URL}/api/auth/google/callback`
- See `GOOGLE_OAUTH_SETUP.md` for configuration instructions

### Tests Failing

```bash
cd frontend && npm run test     # Frontend test details
cd backend && npm run test      # Backend test details
```

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
