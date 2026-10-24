<?php
/**
 * Link Visits API endpoint
 * Handles logging and retrieving link visit statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/Database.php';

session_name(SESSION_NAME);
session_start();

$db = Database::getInstance();
$method = getRequestMethod();

/**
 * Mask IP address for privacy (keep first 2-3 octets)
 */
function maskIpAddress(?string $ip): string {
    if (!$ip) return 'Unknown';
    
    // IPv4
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $parts = explode('.', $ip);
        return $parts[0] . '.' . $parts[1] . '.' . $parts[2] . '.xxx';
    }
    
    // IPv6 - mask last half
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $parts = explode(':', $ip);
        $masked = array_slice($parts, 0, 4);
        return implode(':', $masked) . ':xxxx:xxxx:xxxx:xxxx';
    }
    
    return 'Unknown';
}

/**
 * Parse browser and OS from user agent
 */
function parseUserAgent(string $ua): array {
    $browser = 'Unknown';
    $os = 'Unknown';
    
    // Detect browser
    if (preg_match('/Firefox\/[\d.]+/i', $ua)) {
        $browser = 'Firefox';
    } elseif (preg_match('/Edg\/[\d.]+/i', $ua)) {
        $browser = 'Edge';
    } elseif (preg_match('/Chrome\/[\d.]+/i', $ua) && !preg_match('/Edg\//i', $ua)) {
        $browser = 'Chrome';
    } elseif (preg_match('/Safari\/[\d.]+/i', $ua) && !preg_match('/Chrome\//i', $ua)) {
        $browser = 'Safari';
    } elseif (preg_match('/MSIE|Trident\//i', $ua)) {
        $browser = 'Internet Explorer';
    } elseif (preg_match('/Opera|OPR\//i', $ua)) {
        $browser = 'Opera';
    }
    
    // Detect OS
    if (preg_match('/Windows NT 10/i', $ua)) {
        $os = 'Windows 10/11';
    } elseif (preg_match('/Windows/i', $ua)) {
        $os = 'Windows';
    } elseif (preg_match('/iPhone/i', $ua)) {
        $os = 'iOS (iPhone)';
    } elseif (preg_match('/iPad/i', $ua)) {
        $os = 'iOS (iPad)';
    } elseif (preg_match('/Macintosh|Mac OS/i', $ua)) {
        $os = 'macOS';
    } elseif (preg_match('/Android/i', $ua)) {
        $os = 'Android';
    } elseif (preg_match('/Linux/i', $ua)) {
        $os = 'Linux';
    }
    
    return ['browser' => $browser, 'os' => $os];
}

/**
 * Get real client IP address
 */
function getClientIp(): string {
    $headers = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
    
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ip = $_SERVER[$header];
            // X-Forwarded-For can contain multiple IPs, get the first one
            if (strpos($ip, ',') !== false) {
                $ip = trim(explode(',', $ip)[0]);
            }
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    
    return $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
}

try {
    // POST - Log a visit (public access for public links)
    if ($method === 'POST') {
        $input = getJsonInput();
        $hash = sanitize($input['hash'] ?? '');
        
        if (empty($hash)) {
            errorResponse('Link hash required', 400);
        }
        
        // Find the link by hash (must be public)
        $link = $db->fetchOne(
            "SELECT id FROM links WHERE hash = ? AND is_public = 1",
            [$hash]
        );
        
        if (!$link) {
            errorResponse('Link not found or is private', 404);
        }
        
        // Get visit info
        $ip = getClientIp();
        $maskedIp = maskIpAddress($ip);
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $parsed = parseUserAgent($userAgent);
        $referer = $_SERVER['HTTP_REFERER'] ?? null;
        
        // Log the visit
        $db->insert(
            "INSERT INTO link_visits (link_id, ip_masked, user_agent, browser, os, referer) VALUES (?, ?, ?, ?, ?, ?)",
            [$link['id'], $maskedIp, substr($userAgent, 0, 500), $parsed['browser'], $parsed['os'], $referer]
        );
        
        successResponse([], 'Visit logged');
    }
    
    // GET - Get visit statistics (authenticated, for own links)
    if ($method === 'GET') {
        requireAuth();
        
        $linkId = $_GET['link_id'] ?? null;
        $days = (int)($_GET['days'] ?? 30);
        $days = min(max($days, 1), 365); // Clamp between 1 and 365 days
        
        if ($linkId) {
            // Verify user owns link
            $link = $db->fetchOne(
                "SELECT * FROM links WHERE id = ? AND user_id = ?",
                [$linkId, getCurrentUserId()]
            );
            
            if (!$link) {
                errorResponse('Link not found', 404);
            }
            
            // Get visits for this link
            $visits = $db->fetchAll(
                "SELECT * FROM link_visits 
                 WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')
                 ORDER BY visited_at DESC
                 LIMIT 500",
                [$linkId, $days]
            );
            
            // Get aggregated stats
            $stats = $db->fetchOne(
                "SELECT COUNT(*) as total_visits,
                        COUNT(DISTINCT ip_masked) as unique_visitors
                 FROM link_visits 
                 WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')",
                [$linkId, $days]
            );
            
            // Browser breakdown
            $browsers = $db->fetchAll(
                "SELECT browser, COUNT(*) as count 
                 FROM link_visits 
                 WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')
                 GROUP BY browser
                 ORDER BY count DESC",
                [$linkId, $days]
            );
            
            // OS breakdown
            $operatingSystems = $db->fetchAll(
                "SELECT os, COUNT(*) as count 
                 FROM link_visits 
                 WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')
                 GROUP BY os
                 ORDER BY count DESC",
                [$linkId, $days]
            );
            
            // Daily visits
            $dailyVisits = $db->fetchAll(
                "SELECT date(visited_at) as date, COUNT(*) as count 
                 FROM link_visits 
                 WHERE link_id = ? AND visited_at >= datetime('now', '-' || ? || ' days')
                 GROUP BY date(visited_at)
                 ORDER BY date DESC",
                [$linkId, $days]
            );
            
            successResponse([
                'visits' => $visits,
                'stats' => [
                    'total_visits' => (int)$stats['total_visits'],
                    'unique_visitors' => (int)$stats['unique_visitors'],
                    'browsers' => $browsers,
                    'operating_systems' => $operatingSystems,
                    'daily_visits' => $dailyVisits
                ]
            ]);
        }
        
        // Get visit summary for all links
        $summary = $db->fetchAll(
            "SELECT l.id, l.title, l.hash, COUNT(lv.id) as visit_count
             FROM links l
             LEFT JOIN link_visits lv ON l.id = lv.link_id AND lv.visited_at >= datetime('now', '-' || ? || ' days')
             WHERE l.user_id = ? AND l.is_public = 1
             GROUP BY l.id
             ORDER BY visit_count DESC",
            [$days, getCurrentUserId()]
        );
        
        $totalVisits = $db->fetchOne(
            "SELECT COUNT(*) as count FROM link_visits lv
             JOIN links l ON lv.link_id = l.id
             WHERE l.user_id = ? AND lv.visited_at >= datetime('now', '-' || ? || ' days')",
            [getCurrentUserId(), $days]
        );
        
        successResponse([
            'summary' => $summary,
            'total_visits' => (int)$totalVisits['count'],
            'days' => $days
        ]);
    }
    
} catch (Exception $e) {
    if (DEBUG_MODE) {
        errorResponse($e->getMessage(), 500);
    } else {
        error_log("Link Visits API Error: " . $e->getMessage());
        errorResponse('Something went wrong. Please try again.', 500);
    }
}
