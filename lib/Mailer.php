<?php
/**
 * Mailer class - Sends emails (magic links)
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class Mailer {
    /**
     * Send magic link email
     */
    public static function sendMagicLink($email, $token) {
        $magicLink = SITE_URL . '/api/auth.php?action=verify&token=' . urlencode($token);
        
        $subject = 'Your login link for ' . SITE_NAME;
        
        $message = "
Hello,

Click the link below to log in to " . SITE_NAME . ":

$magicLink

This link will expire in " . (MAGIC_LINK_EXPIRY / 60) . " minutes.

If you didn't request this, you can safely ignore this email.

---
" . SITE_NAME . "
        ";
        
        // For development: just log the link
        if (DEBUG_MODE) {
            error_log("Magic link for $email: { $magicLink }");
            return true;
        }
        
        // Production: Send via SMTP
        return self::sendEmail($email, $subject, $message);
    }
    
    /**
     * Send email via SMTP using PHPMailer
     */
    private static function sendEmail($to, $subject, $message) {
        require_once __DIR__ . '/../vendor/autoload.php';
        
        $mail = new PHPMailer(true);
        
        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = SMTP_HOST;
            $mail->Port = SMTP_PORT;
            
            // Authentication (if credentials are defined)
            if (defined('SMTP_USER') && defined('SMTP_PASS')) {
                $mail->SMTPAuth = true;
                $mail->Username = SMTP_USER;
                $mail->Password = SMTP_PASS;
            } else {
                $mail->SMTPAuth = false;
            }
            
            // Encryption (if defined)
            if (defined('SMTP_ENCRYPTION') && !empty(SMTP_ENCRYPTION)) {
                $mail->SMTPSecure = SMTP_ENCRYPTION;
            } else {
                $mail->SMTPAutoTLS = false;
            }
            
            // Debug mode
            if (DEBUG_MODE) {
                $mail->SMTPDebug = 2;
                $mail->Debugoutput = function($str, $level) {
                    error_log("PHPMailer: $str");
                };
            }
            
            // Recipients
            $mail->setFrom(FROM_EMAIL, FROM_NAME);
            $mail->addAddress($to);
            
            // Content
            $mail->isHTML(false);
            $mail->Subject = $subject;
            $mail->Body = $message;
            
            $mail->send();
            return true;
        } catch (Exception $e) {
            error_log("Mailer Error: {$mail->ErrorInfo}");
            return false;
        }
    }
    
    /**
     * TODO: Implement proper SMTP sending with PHPMailer
     * 
     * Example with PHPMailer:
     * 
     * $mail = new PHPMailer(true);
     * $mail->isSMTP();
     * $mail->Host = SMTP_HOST;
     * $mail->SMTPAuth = true;
     * $mail->Username = SMTP_USER;
     * $mail->Password = SMTP_PASS;
     * $mail->SMTPSecure = SMTP_ENCRYPTION;
     * $mail->Port = SMTP_PORT;
     * $mail->setFrom(FROM_EMAIL, FROM_NAME);
     * $mail->addAddress($to);
     * $mail->Subject = $subject;
     * $mail->Body = $message;
     * $mail->send();
     */
}
