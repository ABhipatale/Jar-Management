<?php

/*
 * Hostinger front controller. public_html holds the React app plus this file; the Laravel
 * app lives one level up in ../laravel (outside the web root, so .env is never served).
 * .htaccess sends /api/* and /up here.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Next to the web root (domains/<site>/laravel), or — for a subdomain whose folder is
// public_html/<sub> — two levels up, next to public_html, still outside every web root.
$laravel = is_dir(__DIR__.'/../laravel/vendor') ? __DIR__.'/../laravel' : __DIR__.'/../../laravel';

if (file_exists($maintenance = $laravel.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $laravel.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $laravel.'/bootstrap/app.php';

// Laravel's public path is this folder, not ../laravel/public.
$app->usePublicPath(__DIR__);

$app->handleRequest(Request::capture());
