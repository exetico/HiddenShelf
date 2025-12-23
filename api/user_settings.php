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
            $sql = "INSERT INTO user_settings (user_id, links_per_page, brand_color) VALUES (?, ?, ?)";
            $db->insert($sql, [$userId, 20, '#738562']);
            $settings = $db->fetchOne("SELECT * FROM user_settings WHERE user_id = ?", [$userId]);
        }
        
        successResponse(['settings' => $settings]);
    }
    
    // PUT - Update user settings
    if ($method === 'PUT') {
        requireAuth();
        
        $userId = getCurrentUserId();
        $input = getJsonInput();
        
        $linksPerPage = isset($input['links_per_page']) ? (int)$input['links_per_page'] : null;
        $brandColor = isset($input['brand_color']) ? sanitize($input['brand_color']) : null;
        
        // Validate links_per_page if provided
        if ($linksPerPage !== null) {
            $validLimits = [20, 50, 100, 250, 500];
            if (!in_array($linksPerPage, $validLimits)) {
                errorResponse('Invalid links_per_page value. Must be one of: ' . implode(', ', $validLimits));
            }
        }
        
        // Validate brand_color if provided
        if ($brandColor !== null && !preg_match('/^#[0-9A-Fa-f]{6}$/', $brandColor)) {
            errorResponse('Invalid brand_color value. Must be a valid hex color (e.g., #738562)');
        }
        
        // Check if settings exist
        $existing = $db->fetchOne("SELECT * FROM user_settings WHERE user_id = ?", [$userId]);
        
        if ($existing) {
            // Build update query dynamically
            $updates = [];
            $params = [];
            
            if ($linksPerPage !== null) {
                $updates[] = 'links_per_page = ?';
                $params[] = $linksPerPage;
            }
            
            if ($brandColor !== null) {
                $updates[] = 'brand_color = ?';
                $params[] = $brandColor;
            }
            
            if (!empty($updates)) {
                $updates[] = 'updated_at = CURRENT_TIMESTAMP';
                $params[] = $userId;
                
                $sql = "UPDATE user_settings SET " . implode(', ', $updates) . " WHERE user_id = ?";
                $db->query($sql, $params);
            }
        } else {
            // Insert with defaults
            $sql = "INSERT INTO user_settings (user_id, links_per_page, brand_color) VALUES (?, ?, ?)";
            $db->insert($sql, [$userId, $linksPerPage ?? 20, $brandColor ?? '#738562']);
        }
        
        $settings = $db->fetchOne("SELECT * FROM user_settings WHERE user_id = ?", [$userId]);
        
        successResponse(['settings' => $settings], 'Settings updated successfully');
    }
    
    errorResponse('Invalid request method', 405);
    
} catch (Exception $e) {
    error_log("User Settings API Error: " . $e->getMessage());
    errorResponse('An error occurred: ' . $e->getMessage());
}
