<?php
/**
 * Configuration file for Hidden Shelf
 * 
 * Copy this file to config.php and update the values
 */

// Database
define('DB_PATH', __DIR__ . '/db/database.sqlite');

// Site configuration
define('SITE_URL', 'http://localhost:8000'); // Update with your domain (e.g., https://example.com)
define('BASE_PATH', ''); // Subpath if app is not at root (e.g., '/links' for example.com/links/)
define('SITE_NAME', 'Hidden Shelf');

// Email configuration (SMTP)
define('SMTP_HOST', 'smtp.example.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'your@email.com');
define('SMTP_PASS', 'your-password');
define('SMTP_ENCRYPTION', 'tls'); // 'tls' or 'ssl'
define('FROM_EMAIL', 'noreply@example.com');
define('FROM_NAME', 'Hidden Shelf');

// Magic link settings
define('MAGIC_LINK_EXPIRY', 15 * 60); // 15 minutes in seconds

// Session settings
define('SESSION_NAME', 'hiddenshelf_session');
define('SESSION_LIFETIME', 30 * 24 * 60 * 60); // 30 days

// Security
define('CSRF_TOKEN_NAME', '_csrf_token');

// Pagination
define('LINKS_PER_PAGE', 20);

// Development mode
define('DEBUG_MODE', true); // Set to false in production

// Registration settings
define('SIGNUP_ENABLED', true); // Set to false to disable new user registration

// App version
define('APP_VERSION', '1.0.0');
