<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../lib/Database.php';

header('Content-Type: application/json');

use League\OAuth2\Client\Provider\Google;

// Load environment variables
$clientId = getenv('GOOGLE_CLIENT_ID');
$clientSecret = getenv('GOOGLE_CLIENT_SECRET');
$redirectUri = getenv('GOOGLE_REDIRECT_URI') ?: 'http://localhost:8080/api/auth/google-callback.php';

if (!$clientId || !$clientSecret) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
    ]);
    exit;
}

$provider = new Google([
    'clientId'     => $clientId,
    'clientSecret' => $clientSecret,
    'redirectUri'  => $redirectUri,
]);

// Generate authorization URL
$authorizationUrl = $provider->getAuthorizationUrl([
    'scope' => ['email', 'profile']
]);

// Store state in session for CSRF protection
session_name(SESSION_NAME);
session_start();
$_SESSION['oauth2state'] = $provider->getState();

echo json_encode([
    'success' => true,
    'authUrl' => $authorizationUrl
]);
