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
        
        // Get settings
        $result = $db->fetchOne("SELECT settings FROM user_settings WHERE user_id = ?", [$userId]);
        
        if (!$result) {
            // Create default settings
            $defaultSettings = json_encode([
                'links_per_page' => 20,
                'brand_color' => '#687061'
            ]);
            $db->insert("INSERT INTO user_settings (user_id, settings) VALUES (?, ?)", [$userId, $defaultSettings]);
            $settings = json_decode($defaultSettings, true);
        } else {
            $settings = json_decode($result['settings'], true);
        }
        
        successResponse(['settings' => $settings]);
    }
    
    // PUT - Update user settings
    if ($method === 'PUT') {
        requireAuth();
        
        $userId = getCurrentUserId();
        $input = getJsonInput();
        
        // Get current settings or defaults
        $result = $db->fetchOne("SELECT settings FROM user_settings WHERE user_id = ?", [$userId]);
        
        if ($result) {
            $settings = json_decode($result['settings'], true);
        } else {
            $settings = [
                'links_per_page' => 20,
                'brand_color' => '#687061'
            ];
        }
        
        // Validate and update links_per_page if provided
        if (isset($input['links_per_page'])) {
            $validLimits = [20, 50, 100, 250, 500];
            if (!in_array((int)$input['links_per_page'], $validLimits)) {
                errorResponse('Invalid links_per_page value. Must be one of: ' . implode(', ', $validLimits));
            }
            $settings['links_per_page'] = (int)$input['links_per_page'];
        }
        
        // Validate and update brand_color if provided
        if (isset($input['brand_color'])) {
            $brandColor = sanitize($input['brand_color']);
            if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $brandColor)) {
                errorResponse('Invalid brand_color value. Must be a valid hex color (e.g., #687061)');
            }
            $settings['brand_color'] = $brandColor;
        }
        
        // Save settings
        $settingsJson = json_encode($settings);
        
        if ($result) {
            $db->query("UPDATE user_settings SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", 
                [$settingsJson, $userId]);
        } else {
            $db->insert("INSERT INTO user_settings (user_id, settings) VALUES (?, ?)", 
                [$userId, $settingsJson]);
        }
        
        successResponse(['settings' => $settings], 'Settings updated successfully');
    }
    
    errorResponse('Invalid request method', 405);
    
} catch (Exception $e) {
    error_log("User Settings API Error: " . $e->getMessage());
    errorResponse('An error occurred: ' . $e->getMessage());
}
