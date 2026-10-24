<?php
/**
 * Tags API endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';

session_name(SESSION_NAME);
session_start();

$db = Database::getInstance();
$method = getRequestMethod();

try {
    // GET - List all tags (with usage count)
    if ($method === 'GET') {
        requireAuth();
        
        $sql = "SELECT t.*, COUNT(lt.link_id) as usage_count 
                FROM tags t 
                LEFT JOIN link_tags lt ON t.id = lt.tag_id 
                WHERE t.user_id = ? 
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
        
        // Check if tag exists for this user
        $existing = $db->fetchOne("SELECT * FROM tags WHERE name = ? AND user_id = ?", [$name, getCurrentUserId()]);
        if ($existing) {
            successResponse(['tag' => $existing], 'Tag already exists');
        }
        
        $tagId = $db->insert("INSERT INTO tags (name, user_id) VALUES (?, ?)", [$name, getCurrentUserId()]);
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
        
        // Verify the tag belongs to the current user
        $tag = $db->fetchOne("SELECT * FROM tags WHERE id = ? AND user_id = ?", [$id, getCurrentUserId()]);
        if (!$tag) {
            errorResponse('Tag not found or access denied', 404);
        }
        
        // Delete the tag (this will cascade delete link_tags due to foreign key)
        $db->query("DELETE FROM tags WHERE id = ?", [$id]);
        
        successResponse([], 'Tag deleted successfully');
    }
    
} catch (Exception $e) {
    if (DEBUG_MODE) {
        errorResponse($e->getMessage(), 500);
    } else {
        error_log("Tags API Error: " . $e->getMessage());
        errorResponse('Something went wrong. Please try again or contact support if the problem persists.', 500);
    }
}
