<?php
declare(strict_types=1);

use craft\elements\Asset;
use craft\elements\Entry;
use yii\db\Expression;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$wpDbHost = getenv('WP_DB_HOST') ?: 'host.docker.internal';
$wpDbPort = (int)(getenv('WP_DB_PORT') ?: 3306);
$wpDbName = getenv('WP_DB_NAME') ?: 'misssponto';
$wpDbUser = getenv('WP_DB_USER') ?: 'misssponto';
$wpDbPassword = getenv('WP_DB_PASSWORD') ?: 'WyBA45v8adZ44y0DkIgw';
$wpTablePrefix = getenv('WP_TABLE_PREFIX') ?: 'ZedPh_';
$wpBaseUrl = rtrim(getenv('WP_BASE_URL') ?: 'http://host.docker.internal', '/');

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $wpDbHost, $wpDbPort, $wpDbName),
    $wpDbUser,
    $wpDbPassword,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
);

$volume = Craft::$app->getVolumes()->getVolumeByHandle('postImages');
if (!$volume) {
    fwrite(STDERR, "Volume 'postImages' not found.\n");
    exit(1);
}

$assetsService = Craft::$app->getAssets();
$elementsService = Craft::$app->getElements();
$db = Craft::$app->getDb();
$now = new Expression('NOW()');

$sql = sprintf(
    'SELECT p.post_name AS slug, pm.meta_value AS elementorData
     FROM %1$sposts p
     INNER JOIN %1$spostmeta pm ON pm.post_id = p.ID AND pm.meta_key = "_elementor_data"
     WHERE p.post_type = "post" AND p.post_status = "publish"',
    $wpTablePrefix
);

$rows = $pdo->query($sql)->fetchAll();

$updated = 0;
$skipped = 0;

foreach ($rows as $row) {
    $slug = trim((string)($row['slug'] ?? ''));
    $elementorData = (string)($row['elementorData'] ?? '');
    if ($slug === '' || $elementorData === '') {
        $skipped++;
        continue;
    }

    $galleryUrls = collectGalleryUrls($elementorData);
    if ($galleryUrls === []) {
        $skipped++;
        continue;
    }

    $entry = Entry::find()
        ->section('posts')
        ->type('post')
        ->slug($slug)
        ->status(null)
        ->one();

    if (!$entry) {
        $skipped++;
        continue;
    }

    $canonicalTitle = (new craft\db\Query())
        ->select('title')
        ->from('{{%elements_sites}}')
        ->where([
            'elementId' => $entry->id,
            'siteId' => $entry->siteId,
        ])
        ->scalar();
    if (is_string($canonicalTitle) && $canonicalTitle !== '') {
        $entry->title = $canonicalTitle;
    }

    $featuredAsset = $entry->featuredImage ? $entry->featuredImage->one() : null;
    $featuredFilename = $featuredAsset ? strtolower((string)$featuredAsset->filename) : null;

    $filteredUrls = [];
    $seenUrls = [];
    foreach ($galleryUrls as $url) {
        $filename = strtolower((string)basename((string)parse_url($url, PHP_URL_PATH)));
        if ($filename === '' || ($featuredFilename !== null && $filename === $featuredFilename)) {
            continue;
        }
        if (isset($seenUrls[$url])) {
            continue;
        }
        $filteredUrls[] = $url;
        $seenUrls[$url] = true;
    }

    if ($filteredUrls === []) {
        $skipped++;
        continue;
    }

    $folderKey = (string)($entry->canonicalId ?: $entry->id);
    $folder = $assetsService->ensureFolderByFullPathAndVolume($folderKey, $volume, true);
    if (!$folder) {
        fwrite(STDERR, "Failed to ensure folder for {$slug}\n");
        $skipped++;
        continue;
    }

    $existingAssets = $entry->postImages ? $entry->postImages->all() : [];
    $existingByFilename = [];
    foreach ($existingAssets as $existingAsset) {
        $existingByFilename[strtolower($existingAsset->filename)] = $existingAsset;
    }

    $assetIds = [];
    foreach ($filteredUrls as $url) {
        $asset = importGalleryAsset($url, $folder->id, $volume->id, $folderKey, $existingByFilename, $wpBaseUrl);
        if ($asset) {
            $assetIds[] = $asset->id;
            $existingByFilename[strtolower($asset->filename)] = $asset;
        }
    }

    if ($assetIds === []) {
        $skipped++;
        continue;
    }

    $entry->setFieldValue('postImages', $assetIds);
    if (!$elementsService->saveElement($entry, true, true, false)) {
        fwrite(STDERR, "Failed to save gallery for {$slug}\n");
        fwrite(STDERR, print_r($entry->getErrors(), true));
        $skipped++;
        continue;
    }

    $db->createCommand()->update(
        '{{%elements}}',
        ['dateUpdated' => $now],
        ['id' => $entry->id]
    )->execute();

    $updated++;
    echo $entry->slug . "\t" . count($assetIds) . PHP_EOL;
}

echo "Done. Updated: {$updated} | Skipped: {$skipped}\n";

/**
 * @return array<int,string>
 */
function collectGalleryUrls(string $elementorData): array
{
    $decoded = json_decode($elementorData, true);
    if (!is_array($decoded)) {
        return [];
    }

    $urls = [];
    walkElementorNodes($decoded, static function(array $node) use (&$urls): void {
        if (($node['widgetType'] ?? null) !== 'gallery') {
            return;
        }

        $galleryItems = $node['settings']['gallery'] ?? null;
        if (!is_array($galleryItems)) {
            return;
        }

        foreach ($galleryItems as $item) {
            $url = trim((string)($item['url'] ?? ''));
            if ($url !== '') {
                $urls[] = $url;
            }
        }
    });

    return $urls;
}

/**
 * @param callable(array<string,mixed>):void $visitor
 * @param array<int|string,mixed> $nodes
 */
function walkElementorNodes(array $nodes, callable $visitor): void
{
    foreach ($nodes as $node) {
        if (!is_array($node)) {
            continue;
        }

        $visitor($node);

        if (isset($node['elements']) && is_array($node['elements'])) {
            walkElementorNodes($node['elements'], $visitor);
        }
    }
}

/**
 * @param array<string,Asset> $existingByFilename
 */
function importGalleryAsset(
    string $url,
    int $folderId,
    int $volumeId,
    string $folderKey,
    array $existingByFilename,
    string $wpBaseUrl
): ?Asset {
    $path = (string)parse_url($url, PHP_URL_PATH);
    $filename = basename($path);
    $filename = preg_replace('/[^A-Za-z0-9._-]/', '-', $filename ?: '');
    if ($filename === null || $filename === '') {
        return null;
    }

    $existing = $existingByFilename[strtolower($filename)] ?? null;
    if ($existing instanceof Asset) {
        return $existing;
    }

    $downloadUrl = preg_match('#^https?://#i', $url)
        ? $wpBaseUrl . $path
        : $wpBaseUrl . '/' . ltrim($url, '/');

    $tempPath = tempnam(sys_get_temp_dir(), 'wp-gallery-');
    if ($tempPath === false) {
        return null;
    }

    $bytes = @file_get_contents($downloadUrl);
    if ($bytes === false) {
        @unlink($tempPath);
        return null;
    }

    file_put_contents($tempPath, $bytes);

    $asset = new Asset();
    $asset->tempFilePath = $tempPath;
    $asset->filename = $filename;
    $asset->newFolderId = $folderId;
    $asset->folderId = $folderId;
    $asset->volumeId = $volumeId;
    $asset->avoidFilenameConflicts = false;
    $asset->setScenario(Asset::SCENARIO_CREATE);

    if (!Craft::$app->getElements()->saveElement($asset, false)) {
        @unlink($tempPath);
        return null;
    }

    @unlink($tempPath);
    echo "Imported {$filename} to posts/{$folderKey}\n";

    return $asset;
}
