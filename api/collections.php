<?php
/**
 * Collections API endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';

session_name(SESSION_NAME);
session_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$db = Database::getInstance();
$method = getRequestMethod();

try {
    // GET - List collections
    if ($method === 'GET') {
        requireAuth();
        
        $sql = "SELECT c.*, COUNT(lc.link_id) as link_count 
                FROM collections c 
                LEFT JOIN link_collections lc ON c.id = lc.collection_id 
                WHERE c.user_id = ? 
                GROUP BY c.id 
                ORDER BY c.created_at DESC";
        
        $collections = $db->fetchAll($sql, [getCurrentUserId()]);
        
        successResponse(['collections' => $collections]);
    }
    
    // POST - Create collection
    if ($method === 'POST') {
        requireAuth();
        
        $input = getJsonInput();
        $name = sanitize($input['name'] ?? '');
        $description = sanitize($input['description'] ?? '');
        
        if (empty($name)) {
            errorResponse('Collection name is required');
        }
        
        $sql = "INSERT INTO collections (user_id, name, description) VALUES (?, ?, ?)";
        $collectionId = $db->insert($sql, [getCurrentUserId(), $name, $description]);
        
        $collection = $db->fetchOne("SELECT * FROM collections WHERE id = ?", [$collectionId]);
        
        successResponse(['collection' => $collection], 'Collection created successfully');
    }
    
    // PUT - Update collection
    if ($method === 'PUT') {
        requireAuth();
        
        $id = $_GET['id'] ?? null;
        if (!$id) {
            errorResponse('Collection ID is required');
        }
        
        $existing = $db->fetchOne("SELECT * FROM collections WHERE id = ? AND user_id = ?", [$id, getCurrentUserId()]);
        if (!$existing) {
            errorResponse('Collection not found', 404);
        }
        
        $input = getJsonInput();
        $name = sanitize($input['name'] ?? $existing['name']);
        $description = sanitize($input['description'] ?? $existing['description']);
        
        if (empty($name)) {
            errorResponse('Collection name is required');
        }
        
        $sql = "UPDATE collections SET name = ?, description = ? WHERE id = ?";
        $db->query($sql, [$name, $description, $id]);
        
        $collection = $db->fetchOne("SELECT * FROM collections WHERE id = ?", [$id]);
        
        successResponse(['collection' => $collection], 'Collection updated successfully');
    }
    
    // DELETE - Delete collection
    if ($method === 'DELETE') {
        requireAuth();
        
        $id = $_GET['id'] ?? null;
        if (!$id) {
            errorResponse('Collection ID is required');
        }
        
        $existing = $db->fetchOne("SELECT * FROM collections WHERE id = ? AND user_id = ?", [$id, getCurrentUserId()]);
        if (!$existing) {
            errorResponse('Collection not found', 404);
        }
        
        $db->query("DELETE FROM collections WHERE id = ?", [$id]);
        
        successResponse([], 'Collection deleted successfully');
    }
    
} catch (Exception $e) {
    if (DEBUG_MODE) {
        errorResponse($e->getMessage(), 500);
    } else {
        errorResponse('An error occurred', 500);
    }
}
