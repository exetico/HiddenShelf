<?php
/**
 * Authentication API endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/Auth.php';
require_once __DIR__ . '/../lib/Mailer.php';

// Start session
session_name(SESSION_NAME);
session_start();

// CORS headers (adjust for production)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$auth = new Auth();
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'login':
            // Request magic link
            if (getRequestMethod() !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            
            $input = getJsonInput();
            $email = $input['email'] ?? '';
            $returnTo = $input['return_to'] ?? null;
            
            // Store return URL in session if provided
            if ($returnTo) {
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                $_SESSION['return_to'] = $returnTo;
            }
            
            $result = $auth->requestMagicLink($email);
            
            if ($result['success']) {
                successResponse([], $result['message']);
            } else {
                errorResponse($result['message']);
            }
            break;
            
        case 'verify':
            // Verify magic link token
            $token = $_GET['token'] ?? '';
            
            $result = $auth->verifyMagicLink($token);
            
            if ($result['success']) {
                // Start session to access stored return URL
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                
                // Check if there's a return URL stored
                $returnTo = $_SESSION['return_to'] ?? '/public/index.html';
                unset($_SESSION['return_to']); // Clear it after using
                
                // Redirect to intended page or default to app
                header('Location: ' . SITE_URL . $returnTo);
                exit;
            } else {
                // Redirect to login with error
                header('Location: ' . SITE_URL . '/public/login.html?error=' . urlencode($result['message']));
                exit;
            }
            break;
            
        case 'logout':
            // Logout
            if (getRequestMethod() !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            
            $result = $auth->logout();
            successResponse([], $result['message']);
            break;
            
        case 'me':
            // Get current user
            if (!isAuthenticated()) {
                errorResponse('Not authenticated', 401);
            }
            
            $user = $auth->getCurrentUser();
            successResponse(['user' => $user]);
            break;
            
        default:
            errorResponse('Invalid action', 400);
    }
} catch (Exception $e) {
    if (DEBUG_MODE) {
        errorResponse($e->getMessage(), 500);
    } else {
        errorResponse('An error occurred', 500);
    }
}
