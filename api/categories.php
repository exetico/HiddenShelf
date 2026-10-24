<?php
/**
 * Categories API endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';

session_name(SESSION_NAME);
session_start();

$db = Database::getInstance();
$method = getRequestMethod();

try {
    // GET - List categories
    if ($method === 'GET') {
        requireAuth();
        
        $sql = "SELECT c.*, COUNT(l.id) as link_count,
                       (SELECT COUNT(*) FROM category_shares cs WHERE cs.category_id = c.id) as is_shared,
                       (SELECT COUNT(*) FROM category_share_members csm WHERE csm.category_id = c.id) as member_count
                FROM categories c 
                LEFT JOIN links l ON c.id = l.category_id 
                WHERE c.user_id = ? 
                GROUP BY c.id 
                ORDER BY c.created_at DESC";
        
        $categories = $db->fetchAll($sql, [getCurrentUserId()]);
        
        successResponse(['categories' => $categories]);
    }
    
    // POST - Create category
    if ($method === 'POST') {
        requireAuth();
        
        $input = getJsonInput();
        $name = sanitize($input['name'] ?? '');
        $icon = sanitize($input['icon'] ?? '');
        $color = sanitize($input['color'] ?? '');
        $directRedirectDefault = (int)($input['direct_redirect_default'] ?? 0);
        
        if (empty($name)) {
            errorResponse('Category name is required');
        }
        
        // Check if category with this name already exists for this user
        $existing = $db->fetchOne(
            "SELECT * FROM categories WHERE user_id = ? AND name = ?", 
            [getCurrentUserId(), $name]
        );
        
        if ($existing) {
            // Return the existing category instead of creating a duplicate
            successResponse(['category' => $existing], 'Category already exists');
        }
        
        $sql = "INSERT INTO categories (user_id, name, icon, color, direct_redirect_default) VALUES (?, ?, ?, ?, ?)";
        $categoryId = $db->insert($sql, [getCurrentUserId(), $name, $icon, $color, $directRedirectDefault]);
        
        $category = $db->fetchOne("SELECT * FROM categories WHERE id = ?", [$categoryId]);
        
        successResponse(['category' => $category], 'Category created successfully');
    }
    
    // PUT - Update category
    if ($method === 'PUT') {
        requireAuth();
        
        $id = $_GET['id'] ?? null;
        if (!$id) {
            errorResponse('Category ID is required');
        }
        
        $existing = $db->fetchOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [$id, getCurrentUserId()]);
        if (!$existing) {
            errorResponse('Category not found', 404);
        }
        
        $input = getJsonInput();
        $name = sanitize($input['name'] ?? $existing['name']);
        $icon = sanitize($input['icon'] ?? $existing['icon']);
        $color = sanitize($input['color'] ?? $existing['color']);
        $directRedirectDefault = isset($input['direct_redirect_default']) ? (int)$input['direct_redirect_default'] : ($existing['direct_redirect_default'] ?? 0);
        
        if (empty($name)) {
            errorResponse('Category name is required');
        }
        
        $sql = "UPDATE categories SET name = ?, icon = ?, color = ?, direct_redirect_default = ? WHERE id = ?";
        $db->query($sql, [$name, $icon, $color, $directRedirectDefault, $id]);
        
        $category = $db->fetchOne("SELECT * FROM categories WHERE id = ?", [$id]);
        
        successResponse(['category' => $category], 'Category updated successfully');
    }
    
    // DELETE - Delete category
    if ($method === 'DELETE') {
        requireAuth();
        
        $id = $_GET['id'] ?? null;
        if (!$id) {
            errorResponse('Category ID is required');
        }
        
        $existing = $db->fetchOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [$id, getCurrentUserId()]);
        if (!$existing) {
            errorResponse('Category not found', 404);
        }
        
        $db->query("DELETE FROM categories WHERE id = ?", [$id]);
        
        successResponse([], 'Category deleted successfully');
    }
    
} catch (Exception $e) {
    if (DEBUG_MODE) {
        errorResponse($e->getMessage(), 500);
    } else {
        error_log("Categories API Error: " . $e->getMessage());
        errorResponse('Something went wrong. Please try again or contact support if the problem persists.', 500);
    }
}
