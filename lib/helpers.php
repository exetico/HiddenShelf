<?php
/**
 * Helper functions
 */

/**
 * Generate a random hash for public links
 */
function generateHash($length = 10) {
    $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $hash = '';
    $max = strlen($characters) - 1;
    
    for ($i = 0; $i < $length; $i++) {
        $hash .= $characters[random_int(0, $max)];
    }
    
    return $hash;
}

/**
 * Generate a secure token for magic links
 */
function generateToken($length = 32) {
    return bin2hex(random_bytes($length));
}

/**
 * Escape HTML output
 */
function e($string) {
    return htmlspecialchars($string, ENT_QUOTES, 'UTF-8');
}

/**
 * Return JSON response
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Return error response
 */
function errorResponse($message, $statusCode = 400) {
    jsonResponse(['error' => $message], $statusCode);
}

/**
 * Return success response
 */
function successResponse($data = [], $message = 'Success') {
    jsonResponse(array_merge(['success' => true, 'message' => $message], $data));
}

/**
 * Get current user ID from session
 */
function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return isset($_SESSION['user_id']);
}

/**
 * Require authentication
 */
function requireAuth() {
    if (!isAuthenticated()) {
        errorResponse('Authentication required', 401);
    }
}

/**
 * Validate email
 */
function isValidEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Validate URL
 */
function isValidUrl($url) {
    if (filter_var($url, FILTER_VALIDATE_URL) === false) {
        return false;
    }
    // Only web links: FILTER_VALIDATE_URL also accepts javascript:, data: etc.,
    // which would run script on our origin when opened from the view page
    $scheme = strtolower(parse_url($url, PHP_URL_SCHEME) ?? '');
    return in_array($scheme, ['http', 'https'], true);
}

/**
 * Return a same-site path to redirect to after login, or the default.
 * Rejects absolute URLs and anything that could be read as another host
 * (e.g. "//evil.com" or "@evil.com" appended to SITE_URL).
 */
function safeReturnPath($returnTo, $default = '/public/index.html') {
    if (!is_string($returnTo) || $returnTo === '') {
        return $default;
    }
    if ($returnTo[0] === '#') {
        return $default . $returnTo;
    }
    if ($returnTo[0] !== '/' || preg_match('#^/[/\\\\]#', $returnTo) || preg_match('/[\\x00-\\x1f\\\\]/', $returnTo)) {
        return $default;
    }
    return $returnTo;
}

/**
 * Generate CSRF token
 */
function generateCsrfToken() {
    if (!isset($_SESSION[CSRF_TOKEN_NAME])) {
        $_SESSION[CSRF_TOKEN_NAME] = bin2hex(random_bytes(32));
    }
    return $_SESSION[CSRF_TOKEN_NAME];
}

/**
 * Verify CSRF token
 */
function verifyCsrfToken($token) {
    return isset($_SESSION[CSRF_TOKEN_NAME]) && hash_equals($_SESSION[CSRF_TOKEN_NAME], $token);
}

/**
 * Get request method
 */
function getRequestMethod() {
    return $_SERVER['REQUEST_METHOD'];
}

/**
 * Get JSON input
 */
function getJsonInput() {
    // Requiring a JSON content type means a cross-site form can't post here
    // without a CORS preflight, which the API doesn't allow
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== 0) {
        errorResponse('Content-Type must be application/json', 415);
    }

    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

/**
 * Sanitize string
 */
function sanitize($string) {
    return trim(strip_tags($string));
}
