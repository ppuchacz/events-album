<?php

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$filePath = __DIR__ . $uri;

if ($uri !== '/' && is_file($filePath)) {
    return false;
}

$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/index.php';
$_SERVER['SCRIPT_NAME'] = '/index.php';

require __DIR__ . '/index.php';
