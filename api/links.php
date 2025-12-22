<?php
/**
 * Links API endpoint - CRUD operations for links
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';

// Start session
session_name(SESSION_NAME);
session_start();

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$db = Database::getInstance();
$method = getRequestMethod();

try {
    // GET - List links or get single link
    if ($method === 'GET') {
        $id = $_GET['id'] ?? null;
        $hash = $_GET['hash'] ?? null;
        
        // Get by hash (public access)
        if ($hash) {
            $sql = "SELECT l.*, u.email as owner_email 
                    FROM links l 
                    JOIN users u ON l.user_id = u.id 
                    WHERE l.hash = ? AND l.is_public = 1";
            $link = $db->fetchOne($sql, [$hash]);
            
            if (!$link) {
                errorResponse('Link not found or is private', 404);
            }
            
            // Get tags
            $link['tags'] = $db->fetchAll(
                "SELECT t.* FROM tags t 
                 JOIN link_tags lt ON t.id = lt.tag_id 
                 WHERE lt.link_id = ?",
                [$link['id']]
            );
            
            // Get collections
            $link['collections'] = $db->fetchAll(
                "SELECT c.* FROM collections c 
                 JOIN link_collections lc ON c.id = lc.collection_id 
                 WHERE lc.link_id = ?",
                [$link['id']]
            );
            
            successResponse(['link' => $link]);
        }
        
        // Get single link (authenticated)
        if ($id) {
            requireAuth();
            
            $sql = "SELECT l.*, c.name as category_name 
                    FROM links l 
                    LEFT JOIN categories c ON l.category_id = c.id 
                    WHERE l.id = ? AND l.user_id = ?";
            $link = $db->fetchOne($sql, [$id, getCurrentUserId()]);
            
            if (!$link) {
                errorResponse('Link not found', 404);
            }
            
            // Get tags
            $link['tags'] = $db->fetchAll(
                "SELECT t.* FROM tags t 
                 JOIN link_tags lt ON t.id = lt.tag_id 
                 WHERE lt.link_id = ?",
                [$link['id']]
            );
            
            // Get collections
            $link['collections'] = $db->fetchAll(
                "SELECT c.* FROM collections c 
                 JOIN link_collections lc ON c.id = lc.collection_id 
                 WHERE lc.link_id = ?",
                [$link['id']]
            );
            
            successResponse(['link' => $link]);
        }
        
        // List all links (authenticated)
        requireAuth();
        
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = LINKS_PER_PAGE;
        $offset = ($page - 1) * $limit;
        
        $categoryId = $_GET['category_id'] ?? null;
        $collectionId = $_GET['collection_id'] ?? null;
        $search = $_GET['search'] ?? null;
        
        // Build query
        $where = ['l.user_id = ?'];
        $params = [getCurrentUserId()];
        
        if ($categoryId) {
            $where[] = 'l.category_id = ?';
            $params[] = $categoryId;
        }
        
        if ($collectionId) {
            $where[] = 'EXISTS (SELECT 1 FROM link_collections lc WHERE lc.link_id = l.id AND lc.collection_id = ?)';
            $params[] = $collectionId;
        }
        
        if ($search) {
            $where[] = '(l.title LIKE ? OR l.description LIKE ? OR l.url LIKE ?)';
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }
        
        $whereClause = implode(' AND ', $where);
        
        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM links l WHERE $whereClause";
        $totalResult = $db->fetchOne($countSql, $params);
        $total = $totalResult['total'];
        
        // Get links
        $sql = "SELECT l.*, c.name as category_name 
                FROM links l 
                LEFT JOIN categories c ON l.category_id = c.id 
                WHERE $whereClause 
                ORDER BY l.created_at DESC 
                LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $links = $db->fetchAll($sql, $params);
        
        // Get tags for each link
        foreach ($links as &$link) {
            $link['tags'] = $db->fetchAll(
                "SELECT t.* FROM tags t 
                 JOIN link_tags lt ON t.id = lt.tag_id 
                 WHERE lt.link_id = ?",
                [$link['id']]
            );
        }
        
        successResponse([
            'links' => $links,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => ceil($total / $limit)
            ]
        ]);
    }
    
    // POST - Create new link
    if ($method === 'POST') {
        requireAuth();
        
        $input = getJsonInput();
        
        $url = sanitize($input['url'] ?? '');
        $title = sanitize($input['title'] ?? '');
        $description = sanitize($input['description'] ?? '');
        $icon = sanitize($input['icon'] ?? '');
        $isPublic = (int)($input['is_public'] ?? 0);
        $categoryId = $input['category_id'] ?? null;
        $tags = $input['tags'] ?? [];
        $collections = $input['collections'] ?? [];
        
        // Validate
        if (empty($url) || !isValidUrl($url)) {
            errorResponse('Valid URL is required');
        }
        
        if (empty($title)) {
            errorResponse('Title is required');
        }
        
        // Generate unique hash
        do {
            $hash = generateHash();
            $existing = $db->fetchOne("SELECT id FROM links WHERE hash = ?", [$hash]);
        } while ($existing);
        
        // Insert link
        $sql = "INSERT INTO links (user_id, hash, url, title, description, icon, is_public, category_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $linkId = $db->insert($sql, [
            getCurrentUserId(),
            $hash,
            $url,
            $title,
            $description,
            $icon,
            $isPublic,
            $categoryId
        ]);
        
        // Add tags
        if (!empty($tags)) {
            foreach ($tags as $tagName) {
                $tagName = sanitize($tagName);
                if (empty($tagName)) continue;
                
                // Get or create tag
                $tag = $db->fetchOne("SELECT id FROM tags WHERE name = ?", [$tagName]);
                if (!$tag) {
                    $tagId = $db->insert("INSERT INTO tags (name) VALUES (?)", [$tagName]);
                } else {
                    $tagId = $tag['id'];
                }
                
                // Link tag
                $db->query("INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)", [$linkId, $tagId]);
            }
        }
        
        // Add to collections
        if (!empty($collections)) {
            foreach ($collections as $collectionId) {
                $db->query("INSERT OR IGNORE INTO link_collections (link_id, collection_id) VALUES (?, ?)", [$linkId, $collectionId]);
            }
        }
        
        // Get created link
        $link = $db->fetchOne("SELECT * FROM links WHERE id = ?", [$linkId]);
        
        successResponse(['link' => $link], 'Link created successfully');
    }
    
    // PUT - Update link
    if ($method === 'PUT') {
        requireAuth();
        
        $id = $_GET['id'] ?? null;
        if (!$id) {
            errorResponse('Link ID is required');
        }
        
        // Check ownership
        $existing = $db->fetchOne("SELECT * FROM links WHERE id = ? AND user_id = ?", [$id, getCurrentUserId()]);
        if (!$existing) {
            errorResponse('Link not found', 404);
        }
        
        $input = getJsonInput();
        
        $url = sanitize($input['url'] ?? $existing['url']);
        $title = sanitize($input['title'] ?? $existing['title']);
        $description = sanitize($input['description'] ?? $existing['description']);
        $icon = sanitize($input['icon'] ?? $existing['icon']);
        $isPublic = isset($input['is_public']) ? (int)$input['is_public'] : $existing['is_public'];
        $categoryId = $input['category_id'] ?? $existing['category_id'];
        
        // Validate
        if (empty($url) || !isValidUrl($url)) {
            errorResponse('Valid URL is required');
        }
        
        if (empty($title)) {
            errorResponse('Title is required');
        }
        
        // Update link
        $sql = "UPDATE links 
                SET url = ?, title = ?, description = ?, icon = ?, is_public = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?";
        $db->query($sql, [$url, $title, $description, $icon, $isPublic, $categoryId, $id]);
        
        // Update tags if provided
        if (isset($input['tags'])) {
            // Remove old tags
            $db->query("DELETE FROM link_tags WHERE link_id = ?", [$id]);
            
            // Add new tags
            foreach ($input['tags'] as $tagName) {
                $tagName = sanitize($tagName);
                if (empty($tagName)) continue;
                
                $tag = $db->fetchOne("SELECT id FROM tags WHERE name = ?", [$tagName]);
                if (!$tag) {
                    $tagId = $db->insert("INSERT INTO tags (name) VALUES (?)", [$tagName]);
                } else {
                    $tagId = $tag['id'];
                }
                
                $db->query("INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)", [$id, $tagId]);
            }
        }
        
        // Update collections if provided
        if (isset($input['collections'])) {
            $db->query("DELETE FROM link_collections WHERE link_id = ?", [$id]);
            
            foreach ($input['collections'] as $collectionId) {
                $db->query("INSERT OR IGNORE INTO link_collections (link_id, collection_id) VALUES (?, ?)", [$id, $collectionId]);
            }
        }
        
        // Get updated link
        $link = $db->fetchOne("SELECT * FROM links WHERE id = ?", [$id]);
        
        successResponse(['link' => $link], 'Link updated successfully');
    }
    
    // DELETE - Delete link
    if ($method === 'DELETE') {
        requireAuth();
        
        $id = $_GET['id'] ?? null;
        if (!$id) {
            errorResponse('Link ID is required');
        }
        
        // Check ownership
        $existing = $db->fetchOne("SELECT * FROM links WHERE id = ? AND user_id = ?", [$id, getCurrentUserId()]);
        if (!$existing) {
            errorResponse('Link not found', 404);
        }
        
        // Delete link (cascades to link_tags and link_collections)
        $db->query("DELETE FROM links WHERE id = ?", [$id]);
        
        successResponse([], 'Link deleted successfully');
    }
    
} catch (Exception $e) {
    if (DEBUG_MODE) {
        errorResponse($e->getMessage(), 500);
    } else {
        errorResponse('An error occurred', 500);
    }
}
