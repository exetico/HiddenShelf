<?php
/**
 * Database class - Handles SQLite connection and migrations
 */

class Database {
    private static $instance = null;
    private $pdo;
    
    private function __construct() {
        $this->connect();
        $this->runMigrations();
    }
    
    /**
     * Get singleton instance
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Connect to SQLite database
     */
    private function connect() {
        try {
            // Ensure db directory exists
            $dbDir = dirname(DB_PATH);
            if (!is_dir($dbDir)) {
                mkdir($dbDir, 0755, true);
            }
            
            $this->pdo = new PDO('sqlite:' . DB_PATH);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            // Enable foreign keys
            $this->pdo->exec('PRAGMA foreign_keys = ON');
        } catch (PDOException $e) {
            die('Database connection failed: ' . $e->getMessage());
        }
    }
    
    /**
     * Get PDO instance
     */
    public function getPdo() {
        return $this->pdo;
    }
    
    /**
     * Run database migrations
     */
    private function runMigrations() {
        // Get current schema version
        $currentVersion = 0;
        try {
            $stmt = $this->pdo->query("SELECT value FROM _meta WHERE key = 'schema_version'");
            $result = $stmt->fetch();
            // An open statement keeps a read lock, which makes DROP TABLE fail
            $stmt->closeCursor();
            if ($result) {
                $currentVersion = (int)$result['value'];
            }
        } catch (PDOException $e) {
            // Table doesn't exist yet, version is 0
        }
        
        // Get migration files
        $migrationsDir = __DIR__ . '/../migrations';
        if (!is_dir($migrationsDir)) {
            return;
        }
        
        $migrations = glob($migrationsDir . '/*.sql');
        if (!$migrations) {
            return;
        }
        
        sort($migrations);
        
        // Run migrations
        foreach ($migrations as $migrationFile) {
            $filename = basename($migrationFile);
            preg_match('/^(\d+)_/', $filename, $matches);
            
            if (!$matches) {
                continue;
            }
            
            $version = (int)$matches[1];
            
            if ($version > $currentVersion) {
                try {
                    $sql = file_get_contents($migrationFile);
                    $this->pdo->exec($sql);
                    
                    // Update schema version
                    $this->pdo->exec("INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '$version')");
                    
                    if (DEBUG_MODE) {
                        error_log("Applied migration: $filename");
                    }
                } catch (PDOException $e) {
                    error_log("Migration failed ($filename): " . $e->getMessage());
                    // Stop here so later migrations don't bump the version past
                    // this one; it is retried on the next request
                    break;
                }
            }
        }
    }
    
    /**
     * Execute a query
     */
    public function query($sql, $params = []) {
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            if (DEBUG_MODE) {
                error_log("Query failed: " . $e->getMessage());
                error_log("SQL: $sql");
                error_log("Params: " . print_r($params, true));
            }
            throw $e;
        }
    }
    
    /**
     * Fetch all rows
     */
    public function fetchAll($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }
    
    /**
     * Fetch single row
     */
    public function fetchOne($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch();
    }
    
    /**
     * Insert and return last insert ID
     */
    public function insert($sql, $params = []) {
        $this->query($sql, $params);
        return $this->pdo->lastInsertId();
    }
    
    /**
     * Begin transaction
     */
    public function beginTransaction() {
        return $this->pdo->beginTransaction();
    }
    
    /**
     * Commit transaction
     */
    public function commit() {
        return $this->pdo->commit();
    }
    
    /**
     * Rollback transaction
     */
    public function rollback() {
        return $this->pdo->rollBack();
    }
}
