<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../lib/Database.php';

use League\OAuth2\Client\Provider\Google;

// Start session with the same name as the app
session_name(SESSION_NAME);
session_start();

// Load environment variables
$clientId = getenv('GOOGLE_CLIENT_ID');
$clientSecret = getenv('GOOGLE_CLIENT_SECRET');
$redirectUri = getenv('GOOGLE_REDIRECT_URI') ?: 'http://localhost:8080/api/auth/google-callback.php';

if (!$clientId || !$clientSecret) {
    header('Location: /public/login.html?error=oauth_not_configured');
    exit;
}

$provider = new Google([
    'clientId'     => $clientId,
    'clientSecret' => $clientSecret,
    'redirectUri'  => $redirectUri,
]);

// Check for errors
if (isset($_GET['error'])) {
    header('Location: /public/login.html?error=oauth_denied');
    exit;
}

// Verify state to prevent CSRF
if (empty($_GET['state']) || !isset($_SESSION['oauth2state']) || ($_GET['state'] !== $_SESSION['oauth2state'])) {
    if (isset($_SESSION['oauth2state'])) {
        unset($_SESSION['oauth2state']);
    }
    header('Location: /public/login.html?error=invalid_state');
    exit;
}

try {
    // Get access token
    $token = $provider->getAccessToken('authorization_code', [
        'code' => $_GET['code']
    ]);

    // Get user details
    $user = $provider->getResourceOwner($token);
    $googleData = $user->toArray();
    
    $email = $googleData['email'];
    $googleId = $googleData['sub'];
    $name = $googleData['name'] ?? '';

    // Connect to database
    $db = Database::getInstance();
    $pdo = $db->getPdo();

    // Check if user exists with this OAuth provider
    $stmt = $pdo->prepare('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?');
    $stmt->execute(['google', $googleId]);
    $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existingUser) {
        // User exists, log them in
        $userId = $existingUser['id'];
    } else {
        // Check if user exists with this email (traditional login)
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $existingEmailUser = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existingEmailUser) {
            // Link OAuth to existing account
            $stmt = $pdo->prepare('UPDATE users SET oauth_provider = ?, oauth_id = ?, oauth_email = ? WHERE id = ?');
            $stmt->execute(['google', $googleId, $email, $existingEmailUser['id']]);
            $userId = $existingEmailUser['id'];
        } else {
            // Check if signup is enabled
            if (defined('SIGNUP_ENABLED') && !SIGNUP_ENABLED) {
                header('Location: /public/login.html?error=signup_disabled');
                exit;
            }
            
            // Create new user
            $stmt = $pdo->prepare('INSERT INTO users (email, oauth_provider, oauth_id, oauth_email, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)');
            $stmt->execute([$email, 'google', $googleId, $email]);
            $userId = $pdo->lastInsertId();
        }
    }

    // Generate magic token for session
    $magicToken = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
    
    $stmt = $pdo->prepare('INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$email, hash('sha256', $magicToken), $expiresAt]);

    // Set session and cookie (new session ID to prevent session fixation)
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['email'] = $email;
    $_SESSION['user_email'] = $email;
    
    setcookie('auth_token', $magicToken, [
        'expires' => strtotime('+30 days'),
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    // Redirect to app
    header('Location: /public/index.html?login=success');
    exit;

} catch (Exception $e) {
    error_log('Google OAuth Error: ' . $e->getMessage());
    header('Location: /public/login.html?error=oauth_failed');
    exit;
}
