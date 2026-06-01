<?php
declare(strict_types=1);

$url = 'http://host.docker.internal/wp-json/wp/v2/posts?per_page=50&page=1&_embed=wp:featuredmedia&status=publish,future,draft,pending,private';
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
$result = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

echo "status={$status}\n";
echo "error={$error}\n";
echo 'len=' . ($result === false ? 0 : strlen($result)) . "\n";
if ($result !== false) {
    echo substr($result, 0, 200) . "\n";
}
