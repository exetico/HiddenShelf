<?php
/**
 * User Settings API endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';

session_name(SESSION_NAME);
session_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$db = Database::getInstance();
$method = getRequestMethod();

try {
    // GET - Get user settings
    if ($method === 'GET') {
        requireAuth();
        
        $userId = getCurrentUserId();
        
        // Get or create settings
        $settings = $db->fetchOne("SELECT * FROM user_settings WHERE user_id = ?", [$userId]);
        
        if (!$settings) {
            // Create default settings
            $sql = "INSERT INTO user_settings (user_id, links_per_page) VALUES (?, ?)";
            $db->insert($sql, [$userId, 20]);
            $settings = $db->fetchOne("SELECT * FROM user_settings WHERE user_id = ?", [$userId]);
        }
        
        successResponse(['settings' => $settings]);
    }
    
    // PUT - Update user settings
    if ($method === 'PUT') {
        requireAuth();
        
        $userId = getCurrentUserId();
        $input = getJsonInput();
        
        $linksPerPage = (int)($input['links_per_page'] ?? 20);
        
        // Validate links_per_page
        $validLimits = [20, 50, 100, 250, 500];
        if (!in_array($linksPerPage, $validLimits)) {
            errorResponse('Invalid links_per_page value. Must be one of: ' . implode(', ', $validLimits));
        }
        
        // Check if settings exist
        $existing = $db->fetchOne("SELECT * FROM user_settings WHERE user_id = ?", [$userId]);
        
        if ($existing) {
            // Update
            $sql = "UPDATE user_settings SET links_per_page = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?";
            $db->query($sql, [$linksPerPage, $userId]);
        } else {
            // Insert
            $sql = "INSERT INTO user_settings (user_id, links_per_page) VALUES (?, ?)";
            $db->insert($sql, [$userId, $linksPerPage]);
        }
        
        $settings = $db->fetchOne("SELECT * FROM user_settings WHERE user_id = ?", [$userId]);
        
        successResponse(['settings' => $settings], 'Settings updated successfully');
    }
    
    errorResponse('Invalid request method', 405);
    
} catch (Exception $e) {
    error_log("User Settings API Error: " . $e->getMessage());
    errorResponse('An error occurred: ' . $e->getMessage());
}
