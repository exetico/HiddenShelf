<?php
/**
 * Tags API endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';

session_name(SESSION_NAME);
session_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$db = Database::getInstance();
$method = getRequestMethod();

try {
    // GET - List all tags (with usage count)
    if ($method === 'GET') {
        requireAuth();
        
        $sql = "SELECT t.*, COUNT(lt.link_id) as usage_count 
                FROM tags t 
                LEFT JOIN link_tags lt ON t.id = lt.tag_id 
                LEFT JOIN links l ON lt.link_id = l.id AND l.user_id = ? 
                GROUP BY t.id 
                ORDER BY usage_count DESC, t.name ASC";
        
        $tags = $db->fetchAll($sql, [getCurrentUserId()]);
        
        successResponse(['tags' => $tags]);
    }
    
    // POST - Create tag
    if ($method === 'POST') {
        requireAuth();
        
        $input = getJsonInput();
        $name = sanitize($input['name'] ?? '');
        
        if (empty($name)) {
            errorResponse('Tag name is required');
        }
        
        // Check if tag exists
        $existing = $db->fetchOne("SELECT * FROM tags WHERE name = ?", [$name]);
        if ($existing) {
            successResponse(['tag' => $existing], 'Tag already exists');
        }
        
        $tagId = $db->insert("INSERT INTO tags (name) VALUES (?)", [$name]);
        $tag = $db->fetchOne("SELECT * FROM tags WHERE id = ?", [$tagId]);
        
        successResponse(['tag' => $tag], 'Tag created successfully');
    }
    
    // DELETE - Delete tag
    if ($method === 'DELETE') {
        requireAuth();
        
        $id = $_GET['id'] ?? null;
        if (!$id) {
            errorResponse('Tag ID is required');
        }
        
        // Check if tag is in use by ANY user (not just current user)
        $usageCount = $db->fetchOne(
            "SELECT COUNT(*) as count FROM link_tags WHERE tag_id = ?", 
            [$id]
        );
        
        if ($usageCount['count'] > 0) {
            errorResponse("Cannot delete tag: it is in use by {$usageCount['count']} link(s).", 403);
        }
        
        // Delete the tag (only if not in use by anyone)
        $db->query("DELETE FROM tags WHERE id = ?", [$id]);
        
        successResponse([], 'Tag deleted successfully');
    }
    
} catch (Exception $e) {
    if (DEBUG_MODE) {
        errorResponse($e->getMessage(), 500);
    } else {
        errorResponse('An error occurred', 500);
    }
}
