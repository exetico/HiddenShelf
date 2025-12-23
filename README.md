# HiddenLinks

A minimal, flexible link-saving solution with public/private sharing capabilities.

## Features

- 🔗 Save links with title, description, and metadata
- 🏷️ Organize with categories and tags
- 🔒 Public/private link sharing (unique hash URLs)
- ✉️ Passwordless authentication via magic links (email)
- 📱 Simple, responsive frontend
- 💾 SQLite database (zero configuration)

## Tech Stack

- **Backend:** PHP 8.x + PDO
- **Database:** SQLite 3
- **Frontend:** HTML + Alpine.js + Tailwind CSS
- **Auth:** Magic link (one-time tokens via email)

## Project Structure

```
HiddenLinks/
├── api/                    # API endpoints
│   ├── auth.php           # Authentication (login, verify)
│   ├── links.php          # CRUD operations for links
│   ├── categories.php     # Categories management
│   └── tags.php           # Tags management
├── db/                    # Database
│   ├── database.sqlite    # SQLite database file
│   └── migrations/        # Schema migrations
│       ├── 001_initial.sql
│       ├── 002_categories.sql
│       └── 003_tags.sql
├── public/                # Frontend files
│   ├── index.html         # Main app
│   ├── login.html         # Login page
│   ├── view.html          # Public link viewer
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── app.js         # Alpine.js components
├── lib/                   # Core utilities
│   ├── Database.php       # Database wrapper + migrations
│   ├── Auth.php           # Authentication logic
│   ├── Mailer.php         # Email sending
│   └── helpers.php        # Utility functions
├── config.php             # Configuration
└── .htaccess              # URL rewriting
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

1. **Start with Docker Compose**

   ```bash
   docker-compose up -d
   ```

   The Tailwind CSS build process runs automatically during container creation.

2. **Access the app**

   - **Test page:** http://localhost:8000/public/test.php (verify setup)
   - **Login page:** http://localhost:8000/public/login.html
   - Database migrations run automatically on first load
   - In dev mode, magic links are logged to Docker logs:
     ```bash
     docker-compose logs -f web
     ```

3. **Stop the app**
   ```bash
   docker-compose down
   ```

### Option 2: Manual Installation

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd HiddenLinks
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
define('FROM_NAME', 'HiddenLinks');
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

### CSS Build Process

HiddenLinks uses Tailwind CSS compiled from source for production. The CSS is built automatically during Docker container creation.

**For Development (with file watching):**

```bash
npm install
npm run watch:css
```

**For Production Build:**

```bash
npm install
npm run build:css
```

The compiled CSS is output to `public/output.css` and is excluded from git. Brand colors are defined using CSS custom properties in `src/input.css`.

### Technical Stack

The app uses vanilla PHP with no framework dependencies:

- Session-based auth
- PDO for database
- Alpine.js for frontend reactivity
- Tailwind CSS (compiled from source)

## Security Features

- CSRF protection on all POST/PUT/DELETE requests
- SQL injection prevention (prepared statements)
- One-time magic tokens (expire after 15 minutes)
- Session hijacking protection
- XSS prevention (output escaping)

## License

MIT

## Future Enhancements

- [ ] Browser extension for quick saving
- [ ] Bookmarklet
- [ ] Import from browser bookmarks
- [ ] Full-text search
- [ ] Link previews/thumbnails
- [ ] Archive.org integration
- [ ] Export to JSON/CSV
