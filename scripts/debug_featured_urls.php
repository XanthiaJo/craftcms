<?php
declare(strict_types=1);

$url = 'http://host.docker.internal/wp-json/wp/v2/posts?per_page=5&_embed=wp:featuredmedia';
$json = file_get_contents($url);
$posts = json_decode($json, true);

foreach ($posts as $post) {
    $slug = $post['slug'] ?? 'no-slug';
    $featured = $post['_embedded']['wp:featuredmedia'][0]['source_url'] ?? '';
    echo $slug . ' => ' . $featured . PHP_EOL;
}
