<?php
/**
 * Category Sharing API endpoint
 * Handles share code generation and share acceptance
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';

session_name(SESSION_NAME);
session_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$db = Database::getInstance();
$method = getRequestMethod();

/**
 * Generate a unique share code
 */
function generateShareCode(): string {
    return bin2hex(random_bytes(16)); // 32 character hex string
}

/**
 * Parse browser and OS from user agent
 */
function parseUserAgent(string $ua): array {
    $browser = 'Unknown';
    $os = 'Unknown';
    
    // Detect browser
    if (preg_match('/Firefox\//i', $ua)) {
        $browser = 'Firefox';
    } elseif (preg_match('/Chrome\//i', $ua) && !preg_match('/Edge\//i', $ua)) {
        $browser = 'Chrome';
    } elseif (preg_match('/Safari\//i', $ua) && !preg_match('/Chrome\//i', $ua)) {
        $browser = 'Safari';
    } elseif (preg_match('/Edge\//i', $ua)) {
        $browser = 'Edge';
    } elseif (preg_match('/MSIE|Trident\//i', $ua)) {
        $browser = 'Internet Explorer';
    }
    
    // Detect OS
    if (preg_match('/Windows/i', $ua)) {
        $os = 'Windows';
    } elseif (preg_match('/Macintosh|Mac OS/i', $ua)) {
        $os = 'macOS';
    } elseif (preg_match('/Linux/i', $ua)) {
        $os = 'Linux';
    } elseif (preg_match('/iPhone|iPad/i', $ua)) {
        $os = 'iOS';
    } elseif (preg_match('/Android/i', $ua)) {
        $os = 'Android';
    }
    
    return ['browser' => $browser, 'os' => $os];
}

try {
    // GET - Get share info for a category or verify a share code
    if ($method === 'GET') {
        $categoryId = $_GET['category_id'] ?? null;
        $shareCode = $_GET['code'] ?? null;
        
        // Verify share code (public - for accepting shares)
        if ($shareCode) {
            $share = $db->fetchOne(
                "SELECT cs.*, c.name as category_name, c.icon, c.color, u.email as owner_email
                 FROM category_shares cs
                 JOIN categories c ON cs.category_id = c.id
                 JOIN users u ON cs.created_by = u.id
                 WHERE cs.share_code = ? AND (cs.expires_at IS NULL OR cs.expires_at > datetime('now'))",
                [$shareCode]
            );
            
            if (!$share) {
                errorResponse('Invalid or expired share code', 404);
            }
            
            // Get link count
            $linkCount = $db->fetchOne(
                "SELECT COUNT(*) as count FROM links WHERE category_id = ?",
                [$share['category_id']]
            );
            
            successResponse([
                'share' => [
                    'category_name' => $share['category_name'],
                    'icon' => $share['icon'],
                    'color' => $share['color'],
                    'owner_email' => $share['owner_email'],
                    'link_count' => $linkCount['count'],
                    'created_at' => $share['created_at']
                ]
            ]);
        }
        
        // Get share info for own category
        if ($categoryId) {
            requireAuth();
            
            // Verify user owns category
            $category = $db->fetchOne(
                "SELECT * FROM categories WHERE id = ? AND user_id = ?",
                [$categoryId, getCurrentUserId()]
            );
            
            if (!$category) {
                errorResponse('Category not found', 404);
            }
            
            // Get existing share
            $share = $db->fetchOne(
                "SELECT * FROM category_shares WHERE category_id = ?",
                [$categoryId]
            );
            
            // Get members
            $members = $db->fetchAll(
                "SELECT csm.*, u.email 
                 FROM category_share_members csm
                 JOIN users u ON csm.user_id = u.id
                 WHERE csm.category_id = ?",
                [$categoryId]
            );
            
            successResponse([
                'share' => $share,
                'members' => $members
            ]);
        }
        
        // Get shared categories (categories shared with current user)
        requireAuth();
        
        $sharedCategories = $db->fetchAll(
            "SELECT c.*, u.email as owner_email, csm.accepted_at
             FROM category_share_members csm
             JOIN categories c ON csm.category_id = c.id
             JOIN users u ON c.user_id = u.id
             WHERE csm.user_id = ?",
            [getCurrentUserId()]
        );
        
        // Get link counts for each
        foreach ($sharedCategories as &$cat) {
            $linkCount = $db->fetchOne(
                "SELECT COUNT(*) as count FROM links WHERE category_id = ?",
                [$cat['id']]
            );
            $cat['link_count'] = $linkCount['count'];
        }
        
        successResponse(['shared_categories' => $sharedCategories]);
    }
    
    // POST - Create share code or accept share
    if ($method === 'POST') {
        requireAuth();
        
        $input = getJsonInput();
        $categoryId = $input['category_id'] ?? null;
        $shareCode = $input['share_code'] ?? null;
        
        // Accept a share
        if ($shareCode) {
            $share = $db->fetchOne(
                "SELECT cs.*, c.user_id as owner_id
                 FROM category_shares cs
                 JOIN categories c ON cs.category_id = c.id
                 WHERE cs.share_code = ? AND (cs.expires_at IS NULL OR cs.expires_at > datetime('now'))",
                [$shareCode]
            );
            
            if (!$share) {
                errorResponse('Invalid or expired share code', 404);
            }
            
            // Can't accept your own share
            if ($share['owner_id'] == getCurrentUserId()) {
                errorResponse('You cannot accept your own share', 400);
            }
            
            // Check if already a member
            $existing = $db->fetchOne(
                "SELECT * FROM category_share_members WHERE category_id = ? AND user_id = ?",
                [$share['category_id'], getCurrentUserId()]
            );
            
            if ($existing) {
                errorResponse('You have already accepted this share', 400);
            }
            
            // Add as member
            $db->insert(
                "INSERT INTO category_share_members (category_id, user_id) VALUES (?, ?)",
                [$share['category_id'], getCurrentUserId()]
            );
            
            successResponse([], 'Successfully joined shared category');
        }
        
        // Create share code for category
        if ($categoryId) {
            // Verify user owns category
            $category = $db->fetchOne(
                "SELECT * FROM categories WHERE id = ? AND user_id = ?",
                [$categoryId, getCurrentUserId()]
            );
            
            if (!$category) {
                errorResponse('Category not found', 404);
            }
            
            // Check if share already exists
            $existing = $db->fetchOne(
                "SELECT * FROM category_shares WHERE category_id = ?",
                [$categoryId]
            );
            
            if ($existing) {
                successResponse(['share' => $existing], 'Share code already exists');
            }
            
            // Generate new share code
            $code = generateShareCode();
            
            $db->insert(
                "INSERT INTO category_shares (category_id, share_code, created_by) VALUES (?, ?, ?)",
                [$categoryId, $code, getCurrentUserId()]
            );
            
            $share = $db->fetchOne(
                "SELECT * FROM category_shares WHERE category_id = ?",
                [$categoryId]
            );
            
            successResponse(['share' => $share], 'Share code created');
        }
        
        errorResponse('Category ID or share code required', 400);
    }
    
    // DELETE - Remove share or leave shared category
    if ($method === 'DELETE') {
        requireAuth();
        
        $categoryId = $_GET['category_id'] ?? null;
        $memberId = $_GET['member_id'] ?? null;
        $leave = isset($_GET['leave']);
        
        if (!$categoryId) {
            errorResponse('Category ID required', 400);
        }
        
        // Leave a shared category
        if ($leave) {
            $db->query(
                "DELETE FROM category_share_members WHERE category_id = ? AND user_id = ?",
                [$categoryId, getCurrentUserId()]
            );
            successResponse([], 'Left shared category');
        }
        
        // Verify user owns category
        $category = $db->fetchOne(
            "SELECT * FROM categories WHERE id = ? AND user_id = ?",
            [$categoryId, getCurrentUserId()]
        );
        
        if (!$category) {
            errorResponse('Category not found', 404);
        }
        
        // Remove specific member
        if ($memberId) {
            $db->query(
                "DELETE FROM category_share_members WHERE category_id = ? AND id = ?",
                [$categoryId, $memberId]
            );
            successResponse([], 'Member removed');
        }
        
        // Delete share code (and all members)
        $db->query("DELETE FROM category_share_members WHERE category_id = ?", [$categoryId]);
        $db->query("DELETE FROM category_shares WHERE category_id = ?", [$categoryId]);
        
        successResponse([], 'Share removed');
    }
    
} catch (Exception $e) {
    if (DEBUG_MODE) {
        errorResponse($e->getMessage(), 500);
    } else {
        error_log("Category Shares API Error: " . $e->getMessage());
        errorResponse('Something went wrong. Please try again.', 500);
    }
}
