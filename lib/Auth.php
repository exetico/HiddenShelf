<?php
/**
 * Auth class - Handles authentication
 */

class Auth {
    private $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Request magic link (send email with token)
     */
    public function requestMagicLink($email) {
        if (!isValidEmail($email)) {
            return ['success' => false, 'message' => 'Invalid email address'];
        }
        
        // Generate token
        $token = generateToken();
        $expiresAt = date('Y-m-d H:i:s', time() + MAGIC_LINK_EXPIRY);
        
        // Save token to database
        $sql = "INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)";
        $this->db->query($sql, [$email, $token, $expiresAt]);
        
        // Send email
        Mailer::sendMagicLink($email, $token);
        
        return ['success' => true, 'message' => 'Magic link sent to your email'];
    }
    
    /**
     * Verify magic link token and log user in
     */
    public function verifyMagicLink($token) {
        if (empty($token)) {
            return ['success' => false, 'message' => 'Token is required'];
        }
        
        // Find token in database
        $sql = "SELECT * FROM magic_tokens WHERE token = ? AND used = 0";
        $tokenData = $this->db->fetchOne($sql, [$token]);
        
        if (!$tokenData) {
            return ['success' => false, 'message' => 'Invalid or already used token'];
        }
        
        // Check if expired
        if (strtotime($tokenData['expires_at']) < time()) {
            return ['success' => false, 'message' => 'Token has expired'];
        }
        
        // Mark token as used
        $sql = "UPDATE magic_tokens SET used = 1 WHERE id = ?";
        $this->db->query($sql, [$tokenData['id']]);
        
        // Get or create user
        $email = $tokenData['email'];
        $user = $this->getOrCreateUser($email);
        
        // Log user in
        $this->login($user['id'], $user['email']);
        
        return ['success' => true, 'message' => 'Login successful', 'user' => $user];
    }
    
    /**
     * Get or create user by email
     */
    private function getOrCreateUser($email) {
        // Try to find existing user
        $sql = "SELECT * FROM users WHERE email = ?";
        $user = $this->db->fetchOne($sql, [$email]);
        
        if ($user) {
            return $user;
        }
        
        // Create new user
        $sql = "INSERT INTO users (email) VALUES (?)";
        $userId = $this->db->insert($sql, [$email]);
        
        return [
            'id' => $userId,
            'email' => $email,
            'created_at' => date('Y-m-d H:i:s')
        ];
    }
    
    /**
     * Log user in (set session)
     */
    private function login($userId, $email) {
        $_SESSION['user_id'] = $userId;
        $_SESSION['user_email'] = $email;
        $_SESSION['logged_in_at'] = time();
        
        // Regenerate session ID for security
        session_regenerate_id(true);
    }
    
    /**
     * Log user out
     */
    public function logout() {
        $_SESSION = [];
        session_destroy();
        return ['success' => true, 'message' => 'Logged out successfully'];
    }
    
    /**
     * Get current user
     */
    public function getCurrentUser() {
        if (!isAuthenticated()) {
            return null;
        }
        
        $sql = "SELECT * FROM users WHERE id = ?";
        return $this->db->fetchOne($sql, [getCurrentUserId()]);
    }
    
    /**
     * Clean up expired tokens (maintenance)
     */
    public function cleanupExpiredTokens() {
        $sql = "DELETE FROM magic_tokens WHERE expires_at < datetime('now')";
        $this->db->query($sql);
    }
}
