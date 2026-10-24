<?php
/**
 * Public app config endpoint - only values that are safe to expose
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';

successResponse([
    'app_version' => defined('APP_VERSION') ? APP_VERSION : '1.0.0',
    'site_name' => SITE_NAME,
]);
