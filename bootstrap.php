<?php
/**
 * Shared bootstrap file
 */

// Set the error reporting level
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

// Define path constants
define('CRAFT_BASE_PATH', __DIR__);
define('CRAFT_VENDOR_PATH', CRAFT_BASE_PATH . '/vendor');

// Load Composer's autoloader
require_once CRAFT_VENDOR_PATH . '/autoload.php';

// Load custom web helpers
require_once CRAFT_BASE_PATH . '/modules/remote-markdown/RemoteMarkdownModule.php';
require_once CRAFT_BASE_PATH . '/modules/remote-markdown/RemoteMarkdownTwigExtension.php';

// Load dotenv?
if (class_exists(Dotenv\Dotenv::class)) {
    $envFile = '.env';

    if (getenv('IS_DDEV_PROJECT') === 'true' && file_exists(CRAFT_BASE_PATH . '/.env.dev')) {
        $envFile = '.env.dev';
    }

    Dotenv\Dotenv::createMutable(CRAFT_BASE_PATH, [$envFile])->safeLoad();
}
