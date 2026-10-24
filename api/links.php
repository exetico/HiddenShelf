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

$db = Database::getInstance();
$method = getRequestMethod();

/**
 * Check the category belongs to the current user, so links can't be
 * pushed into someone else's (shared) category
 */
function ownsCategory($db, $categoryId) {
    return (bool)$db->fetchOne(
        "SELECT id FROM categories WHERE id = ? AND user_id = ?",
        [$categoryId, getCurrentUserId()]
    );
}

try {
    // GET - List links or get single link
    if ($method === 'GET') {
        $id = $_GET['id'] ?? null;
        $hash = $_GET['hash'] ?? null;
        
        // Get by hash (public access)
        if ($hash) {
            // Public: only the fields the view page needs, never the owner's email
            $sql = "SELECT l.id, l.hash, l.url, l.title, l.description, l.icon,
                           l.direct_redirect, l.created_at, l.updated_at
                    FROM links l 
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
            
            successResponse(['link' => $link]);
        }
        
        // List all links (authenticated)
        requireAuth();
        
        $page = max(1, (int)($_GET['page'] ?? 1));
        
        // Get limit from request, validate it, or use default
        $requestedLimit = (int)($_GET['limit'] ?? LINKS_PER_PAGE);
        $validLimits = [20, 50, 100, 250, 500];
        $limit = in_array($requestedLimit, $validLimits) ? $requestedLimit : LINKS_PER_PAGE;
        
        $offset = ($page - 1) * $limit;
        
        $categoryId = $_GET['category_id'] ?? null;
        $search = $_GET['search'] ?? null;
        $includeShared = isset($_GET['include_shared']) ? (bool)$_GET['include_shared'] : true;
        
        // Build query - include own links and links from shared categories
        $where = [];
        $params = [];
        
        if ($includeShared) {
            // Get IDs of shared categories user has access to
            $sharedCatIds = $db->fetchAll(
                "SELECT category_id FROM category_share_members WHERE user_id = ?",
                [getCurrentUserId()]
            );
            $sharedIds = array_column($sharedCatIds, 'category_id');
            
            if (!empty($sharedIds)) {
                $placeholders = implode(',', array_fill(0, count($sharedIds), '?'));
                $where[] = "(l.user_id = ? OR l.category_id IN ($placeholders))";
                $params[] = getCurrentUserId();
                $params = array_merge($params, $sharedIds);
            } else {
                $where[] = 'l.user_id = ?';
                $params[] = getCurrentUserId();
            }
        } else {
            $where[] = 'l.user_id = ?';
            $params[] = getCurrentUserId();
        }
        
        if ($categoryId) {
            $where[] = 'l.category_id = ?';
            $params[] = $categoryId;
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
        $sql = "SELECT l.*, c.name as category_name,
                       CASE WHEN l.user_id != ? THEN 1 ELSE 0 END as is_from_shared_category
                FROM links l 
                LEFT JOIN categories c ON l.category_id = c.id 
                WHERE $whereClause 
                ORDER BY 
                    CASE WHEN l.display_order IS NULL THEN 1 ELSE 0 END,
                    l.display_order ASC,
                    l.created_at DESC 
                LIMIT ? OFFSET ?";
        // Add user ID for is_from_shared_category check
        $linksParams = array_merge([getCurrentUserId()], $params);
        $linksParams[] = $limit;
        $linksParams[] = $offset;
        
        $links = $db->fetchAll($sql, $linksParams);
        
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
        $displayOrder = isset($input['display_order']) ? (is_null($input['display_order']) ? null : (int)$input['display_order']) : null;
        $directRedirect = (int)($input['direct_redirect'] ?? 0);
        $tags = $input['tags'] ?? [];
        
        // Validate
        if (empty($url) || !isValidUrl($url)) {
            errorResponse('Valid URL is required');
        }
        
        if (empty($title)) {
            errorResponse('Title is required');
        }
        
        if ($categoryId && !ownsCategory($db, $categoryId)) {
            errorResponse('Category not found', 404);
        }
        
        // If category is set and direct_redirect not explicitly provided, inherit from category
        if ($categoryId && !isset($input['direct_redirect'])) {
            $category = $db->fetchOne("SELECT direct_redirect_default FROM categories WHERE id = ?", [$categoryId]);
            if ($category && $category['direct_redirect_default']) {
                $directRedirect = (int)$category['direct_redirect_default'];
            }
        }
        
        // Generate unique hash
        do {
            $hash = generateHash();
            $existing = $db->fetchOne("SELECT id FROM links WHERE hash = ?", [$hash]);
        } while ($existing);
        
        // Insert link
        $sql = "INSERT INTO links (user_id, hash, url, title, description, icon, is_public, category_id, display_order, direct_redirect) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $linkId = $db->insert($sql, [
            getCurrentUserId(),
            $hash,
            $url,
            $title,
            $description,
            $icon,
            $isPublic,
            $categoryId,
            $displayOrder,
            $directRedirect
        ]);
        
        // Add tags
        if (!empty($tags)) {
            foreach ($tags as $tagName) {
                $tagName = sanitize($tagName);
                if (empty($tagName)) continue;
                
                // Get or create tag (per user)
                $tag = $db->fetchOne("SELECT id FROM tags WHERE name = ? AND user_id = ?", [$tagName, getCurrentUserId()]);
                if (!$tag) {
                    $tagId = $db->insert("INSERT INTO tags (name, user_id) VALUES (?, ?)", [$tagName, getCurrentUserId()]);
                } else {
                    $tagId = $tag['id'];
                }
                
                // Link tag
                $db->query("INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)", [$linkId, $tagId]);
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
        $displayOrder = isset($input['display_order']) ? (is_null($input['display_order']) ? null : (int)$input['display_order']) : $existing['display_order'];
        $directRedirect = isset($input['direct_redirect']) ? (int)$input['direct_redirect'] : ($existing['direct_redirect'] ?? 0);
        
        // Validate
        if (empty($url) || !isValidUrl($url)) {
            errorResponse('Valid URL is required');
        }
        
        if (empty($title)) {
            errorResponse('Title is required');
        }
        
        if ($categoryId && $categoryId != $existing['category_id'] && !ownsCategory($db, $categoryId)) {
            errorResponse('Category not found', 404);
        }
        
        // Update link
        $sql = "UPDATE links 
                SET url = ?, title = ?, description = ?, icon = ?, is_public = ?, category_id = ?, display_order = ?, direct_redirect = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?";
        $db->query($sql, [$url, $title, $description, $icon, $isPublic, $categoryId, $displayOrder, $directRedirect, $id]);
        
        // Update tags if provided
        if (isset($input['tags'])) {
            // Remove old tags
            $db->query("DELETE FROM link_tags WHERE link_id = ?", [$id]);
            
            // Add new tags
            foreach ($input['tags'] as $tagName) {
                $tagName = sanitize($tagName);
                if (empty($tagName)) continue;
                
                $tag = $db->fetchOne("SELECT id FROM tags WHERE name = ? AND user_id = ?", [$tagName, getCurrentUserId()]);
                if (!$tag) {
                    $tagId = $db->insert("INSERT INTO tags (name, user_id) VALUES (?, ?)", [$tagName, getCurrentUserId()]);
                } else {
                    $tagId = $tag['id'];
                }
                
                $db->query("INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)", [$id, $tagId]);
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
        error_log("Links API Error: " . $e->getMessage());
        errorResponse('Something went wrong. Please try again or contact support if the problem persists.', 500);
    }
}
