<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hidden Shelf - System Test</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen p-8">
    <div class="max-w-4xl mx-auto">
        <?php
        require_once __DIR__ . '/../config.php';
        
        // SECURITY: Only allow access if DEBUG_MODE is enabled OR from localhost
        $allowedIPs = ['127.0.0.1', '::1', 'localhost'];
        $clientIP = $_SERVER['REMOTE_ADDR'] ?? '';
        $isLocalhost = in_array($clientIP, $allowedIPs) || strpos($clientIP, '172.') === 0; // Docker networks
        
        if (!DEBUG_MODE && !$isLocalhost) {
            echo '<div class="bg-red-100 border-2 border-red-500 rounded-lg p-8">';
            echo '<h1 class="text-2xl font-bold text-red-800 mb-2">⚠ Access Denied</h1>';
            echo '<p class="text-red-700">This test page is only accessible in debug mode or from localhost.</p>';
            echo '<p class="text-sm text-red-600 mt-4">To enable access, set <code class="bg-red-200 px-2 py-1 rounded">DEBUG_MODE = true</code> in config.php</p>';
            echo '</div>';
            exit;
        }
        
        // Warning banner if accessible
        if (DEBUG_MODE) {
            echo '<div class="bg-yellow-100 border border-yellow-400 rounded-lg p-4 mb-6">';
            echo '<p class="text-yellow-800 font-semibold">⚠ Security Warning</p>';
            echo '<p class="text-sm text-yellow-700 mt-1">Debug mode is enabled. Disable this in production by setting <code class="bg-yellow-200 px-2 py-1 rounded">DEBUG_MODE = false</code> in config.php</p>';
            echo '</div>';
        }
        ?>
        
        <div class="bg-white rounded-lg shadow-md p-8 mb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Hidden Shelf System Test</h1>
            <p class="text-gray-600 mb-6">Verify your installation is working correctly</p>
            
            <?php
            
            $tests = [];
            $allPassed = true;
            
            // Test 1: PHP Version
            $phpVersion = phpversion();
            $phpOk = version_compare($phpVersion, '8.0.0', '>=');
            $tests[] = [
                'name' => 'PHP Version',
                'status' => $phpOk,
                'message' => $phpOk 
                    ? "PHP $phpVersion (✓ Meets requirement: 8.0+)" 
                    : "PHP $phpVersion (✗ Requires PHP 8.0 or higher)",
                'details' => null
            ];
            $allPassed = $allPassed && $phpOk;
            
            // Test 2: SQLite Extension
            $sqliteOk = extension_loaded('sqlite3');
            $tests[] = [
                'name' => 'SQLite3 Extension',
                'status' => $sqliteOk,
                'message' => $sqliteOk ? 'SQLite3 extension loaded' : 'SQLite3 extension not found',
                'details' => $sqliteOk ? 'Version: ' . SQLite3::version()['versionString'] : null
            ];
            $allPassed = $allPassed && $sqliteOk;
            
            // Test 3: PDO SQLite
            $pdoSqliteOk = extension_loaded('pdo_sqlite');
            $tests[] = [
                'name' => 'PDO SQLite Extension',
                'status' => $pdoSqliteOk,
                'message' => $pdoSqliteOk ? 'PDO SQLite extension loaded' : 'PDO SQLite extension not found',
                'details' => null
            ];
            $allPassed = $allPassed && $pdoSqliteOk;
            
            // Test 4: Database Directory Writable
            $dbDir = dirname(DB_PATH);
            $dirWritable = is_writable($dbDir);
            $tests[] = [
                'name' => 'Database Directory Writable',
                'status' => $dirWritable,
                'message' => $dirWritable ? "Directory is writable: $dbDir" : "Directory is not writable: $dbDir",
                'details' => $dirWritable ? 'Permissions: ' . substr(sprintf('%o', fileperms($dbDir)), -4) : null
            ];
            $allPassed = $allPassed && $dirWritable;
            
            // Test 5: Database Connection
            $dbConnected = false;
            $dbError = null;
            try {
                require_once __DIR__ . '/../lib/Database.php';
                $db = Database::getInstance();
                $dbConnected = true;
                $dbSize = file_exists(DB_PATH) ? filesize(DB_PATH) : 0;
                $tests[] = [
                    'name' => 'Database Connection',
                    'status' => true,
                    'message' => 'Successfully connected to SQLite database',
                    'details' => 'Database file: ' . basename(DB_PATH) . ' (' . round($dbSize / 1024, 2) . ' KB)'
                ];
            } catch (Exception $e) {
                $dbError = $e->getMessage();
                $tests[] = [
                    'name' => 'Database Connection',
                    'status' => false,
                    'message' => 'Failed to connect to database',
                    'details' => $dbError
                ];
                $allPassed = false;
            }
            
            // Test 6: Database Schema
            if ($dbConnected) {
                try {
                    $db = Database::getInstance();
                    $version = $db->fetchOne("SELECT value FROM _meta WHERE key = 'schema_version'");
                    $schemaVersion = $version ? $version['value'] : 'Not initialized';
                    
                    // Count tables
                    $tables = $db->fetchAll("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
                    $tableCount = count($tables);
                    
                    $tests[] = [
                        'name' => 'Database Schema',
                        'status' => $tableCount > 0,
                        'message' => "Schema version: $schemaVersion",
                        'details' => "$tableCount tables created: " . implode(', ', array_column($tables, 'name'))
                    ];
                } catch (Exception $e) {
                    $tests[] = [
                        'name' => 'Database Schema',
                        'status' => false,
                        'message' => 'Schema check failed',
                        'details' => $e->getMessage()
                    ];
                    $allPassed = false;
                }
            }
            
            // Test 7: PHPMailer
            $phpmailerOk = file_exists(__DIR__ . '/../vendor/autoload.php');
            if ($phpmailerOk) {
                require_once __DIR__ . '/../vendor/autoload.php';
                $phpmailerOk = class_exists('PHPMailer\\PHPMailer\\PHPMailer');
            }
            $tests[] = [
                'name' => 'PHPMailer Library',
                'status' => $phpmailerOk,
                'message' => $phpmailerOk ? 'PHPMailer installed and available' : 'PHPMailer not found (run: composer install)',
                'details' => null
            ];
            $allPassed = $allPassed && $phpmailerOk;
            
            // Test 8: Configuration
            $configOk = defined('SITE_URL') && defined('FROM_EMAIL') && defined('SMTP_HOST');
            $tests[] = [
                'name' => 'Configuration',
                'status' => $configOk,
                'message' => $configOk ? 'Configuration loaded successfully' : 'Configuration incomplete',
                'details' => $configOk ? 'Site URL: ' . SITE_URL . '<br>From Email: ' . FROM_EMAIL . '<br>SMTP Host: ' . SMTP_HOST . ':' . SMTP_PORT : null
            ];
            
            // Test 9: SMTP Connection Test
            if ($phpmailerOk && isset($_POST['test_smtp'])) {
                require_once __DIR__ . '/../lib/Mailer.php';
                
                $testEmail = $_POST['test_email'] ?? '';
                if (!empty($testEmail) && filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
                    // Temporarily disable debug mode to actually send
                    $originalDebug = DEBUG_MODE;
                    if (!defined('DEBUG_MODE_OVERRIDE')) {
                        define('DEBUG_MODE_OVERRIDE', false);
                    }
                    
                    try {
                        $result = Mailer::sendMagicLink($testEmail, 'TEST_TOKEN_' . time());
                        $tests[] = [
                            'name' => 'SMTP Email Test',
                            'status' => $result,
                            'message' => $result ? "Test email sent to $testEmail" : "Failed to send test email",
                            'details' => $result ? 'Check your email inbox (or SMTPBucket)' : 'Check error logs for details'
                        ];
                    } catch (Exception $e) {
                        $tests[] = [
                            'name' => 'SMTP Email Test',
                            'status' => false,
                            'message' => 'SMTP test failed',
                            'details' => $e->getMessage()
                        ];
                    }
                }
            }
            
            // Display Results
            foreach ($tests as $test) {
                $bgColor = $test['status'] ? 'bg-green-50' : 'bg-red-50';
                $textColor = $test['status'] ? 'text-green-700' : 'text-red-700';
                $borderColor = $test['status'] ? 'border-green-200' : 'border-red-200';
                $icon = $test['status'] ? '✓' : '✗';
                
                echo "<div class='mb-4 p-4 border-l-4 $bgColor $borderColor'>";
                echo "<div class='flex items-start'>";
                echo "<span class='text-2xl mr-3'>$icon</span>";
                echo "<div class='flex-1'>";
                echo "<h3 class='font-semibold $textColor'>{$test['name']}</h3>";
                echo "<p class='text-sm text-gray-700'>{$test['message']}</p>";
                if ($test['details']) {
                    echo "<p class='text-xs text-gray-600 mt-1'>{$test['details']}</p>";
                }
                echo "</div>";
                echo "</div>";
                echo "</div>";
            }
            
            // Overall Status
            if ($allPassed) {
                echo "<div class='mt-6 p-6 bg-green-100 border-2 border-green-500 rounded-lg'>";
                echo "<h2 class='text-xl font-bold text-green-800 mb-2'>✓ All Tests Passed!</h2>";
                echo "<p class='text-green-700'>Your Hidden Shelf installation is ready to use.</p>";
                echo "<div class='mt-4'>";
                echo "<a href='/public/login.html' class='inline-block bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700'>Go to Login Page →</a>";
                echo "</div>";
                echo "</div>";
            } else {
                echo "<div class='mt-6 p-6 bg-yellow-100 border-2 border-yellow-500 rounded-lg'>";
                echo "<h2 class='text-xl font-bold text-yellow-800 mb-2'>⚠ Some Tests Failed</h2>";
                echo "<p class='text-yellow-700'>Please fix the issues above before using the application.</p>";
                echo "</div>";
            }
            ?>
        </div>
        
        <!-- SMTP Test Form -->
        <?php if ($phpmailerOk && !DEBUG_MODE): ?>
        <div class="bg-white rounded-lg shadow-md p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Test SMTP Email</h2>
            <p class="text-gray-600 mb-4">Send a test magic link email to verify SMTP configuration</p>
            
            <form method="POST" class="space-y-4">
                <div>
                    <label for="test_email" class="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                    </label>
                    <input 
                        type="email" 
                        id="test_email" 
                        name="test_email"
                        required
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="your@email.com"
                    >
                </div>
                <button 
                    type="submit" 
                    name="test_smtp"
                    class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                    Send Test Email
                </button>
            </form>
        </div>
        <?php elseif (DEBUG_MODE): ?>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 class="font-semibold text-blue-800 mb-2">Debug Mode Active</h3>
            <p class="text-sm text-blue-700">
                Email testing is disabled in debug mode. Magic links are logged to error log instead of being sent.
                Set <code class="bg-blue-100 px-2 py-1 rounded">DEBUG_MODE = false</code> in config.php to test real email sending.
            </p>
        </div>
        <?php endif; ?>
        
        <!-- System Info -->
        <div class="bg-gray-100 rounded-lg p-6 mt-6">
            <h3 class="font-semibold text-gray-800 mb-3">System Information</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="text-gray-600">PHP Version:</span>
                    <span class="text-gray-900 font-mono ml-2"><?php echo phpversion(); ?></span>
                </div>
                <div>
                    <span class="text-gray-600">Debug Mode:</span>
                    <span class="text-gray-900 font-mono ml-2"><?php echo DEBUG_MODE ? 'ON' : 'OFF'; ?></span>
                </div>
                <div>
                    <span class="text-gray-600">Database Path:</span>
                    <span class="text-gray-900 font-mono ml-2 text-xs"><?php echo DB_PATH; ?></span>
                </div>
                <div>
                    <span class="text-gray-600">Site URL:</span>
                    <span class="text-gray-900 font-mono ml-2 text-xs"><?php echo SITE_URL; ?></span>
                </div>
            </div>
        </div>
        
        <div class="text-center mt-6 text-sm text-gray-500">
            <p>Hidden Shelf System Test • <a href="/" class="text-blue-600 hover:underline">Back to Home</a></p>
        </div>
    </div>
</body>
</html>
