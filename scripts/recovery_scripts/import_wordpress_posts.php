<?php
declare(strict_types=1);

use craft\elements\Asset;
use craft\elements\Entry;

require dirname(__DIR__) . '/bootstrap.php';

$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$wpApiBase = getenv('WP_API_BASE') ?: 'http://host.docker.internal/wp-json/wp/v2';
$sectionHandle = 'posts';
$entryTypeHandle = 'post';
$perPage = 50;
$maxPages = (int)(getenv('WP_MAX_PAGES') ?: 0); // 0 = all pages
$importImages = (getenv('WP_IMPORT_IMAGES') ?: '0') === '1';
$imagesVolumeHandle = getenv('WP_IMAGES_VOLUME') ?: '';

$entriesService = Craft::$app->getEntries();
$elementsService = Craft::$app->getElements();
$assetsService = Craft::$app->getAssets();
$volumesService = Craft::$app->getVolumes();
$site = Craft::$app->getSites()->getPrimarySite();

$section = $entriesService->getSectionByHandle($sectionHandle);
if (!$section) {
    fwrite(STDERR, "Section '$sectionHandle' not found.\n");
    exit(1);
}

$entryType = $entriesService->getEntryTypeByHandle($entryTypeHandle);
if (!$entryType) {
    fwrite(STDERR, "Entry type '$entryTypeHandle' not found.\n");
    exit(1);
}

$volume = null;
$rootFolder = null;
if ($importImages) {
    if ($imagesVolumeHandle !== '') {
        $volume = $volumesService->getVolumeByHandle($imagesVolumeHandle);
    } else {
        $allVolumes = $volumesService->getAllVolumes();
        $volume = $allVolumes[0] ?? null;
    }

    if (!$volume) {
        fwrite(STDERR, "No Assets volume found for featured image import. Continuing without images.\n");
        $importImages = false;
    } else {
        $rootFolder = $assetsService->getRootFolderByVolumeId($volume->id);
    }
}

echo "Importing WordPress posts from: $wpApiBase\n";
echo "Target section/type: {$section->handle}/{$entryType->handle}\n";
echo "Import images: " . ($importImages ? 'yes' : 'no') . "\n";

$page = 1;
$created = 0;
$updated = 0;
$skipped = 0;

while (true) {
    if ($maxPages > 0 && $page > $maxPages) {
        break;
    }

    $url = sprintf(
        '%s/posts?per_page=%d&page=%d&_embed=wp:featuredmedia',
        rtrim($wpApiBase, '/'),
        $perPage,
        $page
    );

    $json = httpGet($url);
    if ($json === false) {
        if ($page === 1) {
            fwrite(STDERR, "Unable to fetch WordPress posts at $url\n");
            exit(1);
        }
        break;
    }

    $posts = json_decode($json, true);
    if (!is_array($posts) || $posts === []) {
        break;
    }

    echo "Page $page: " . count($posts) . " posts\n";

    foreach ($posts as $post) {
        $slug = trim((string)($post['slug'] ?? ''));
        $title = html_entity_decode((string)($post['title']['rendered'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        if ($slug === '' || $title === '') {
            $skipped++;
            continue;
        }

        $entry = Entry::find()
            ->section($section->handle)
            ->siteId($site->id)
            ->slug($slug)
            ->status(null)
            ->one();

        $isNew = !$entry;
        if ($isNew) {
            $entry = new Entry();
            $entry->sectionId = $section->id;
            $entry->typeId = $entryType->id;
            $entry->siteId = $site->id;
            $entry->enabled = true;
        }

        $postDateRaw = (string)($post['date_gmt'] ?? $post['date'] ?? '');
        $postDate = $postDateRaw ? new DateTime($postDateRaw) : new DateTime();
        $contentHtml = (string)($post['content']['rendered'] ?? '');
        $importedLinks = extractLinks($contentHtml);
        $existingRows = is_array($entry->resourceLinks ?? null) ? $entry->resourceLinks : [];
        $mergedRows = mergeResourceLinks($existingRows, $importedLinks);

        $entry->title = $title;
        $entry->slug = $slug;
        $entry->postDate = $postDate;
        $entry->setFieldValue(
            'body',
            stripTrailingLinkLabels(
                normalizeBodyText($contentHtml),
                resourceLinkLabels($mergedRows)
            )
        );
        $entry->setFieldValue('resourceLinks', $mergedRows);

        if ($importImages) {
            $featuredUrl = $post['_embedded']['wp:featuredmedia'][0]['source_url'] ?? null;
            if (is_string($featuredUrl) && $featuredUrl !== '') {
                $asset = importFeaturedImage($featuredUrl, $volume->id, $rootFolder->id);
                if ($asset) {
                    $entry->setFieldValue('featuredImage', [$asset->id]);
                }
            }
        }

        if (!$elementsService->saveElement($entry, true, true, false)) {
            $errors = print_r($entry->getErrors(), true);
            fwrite(STDERR, "Failed to save '$title' ($slug)\n$errors\n");
            $skipped++;
            continue;
        }

        if ($isNew) {
            $created++;
        } else {
            $updated++;
        }
    }

    $page++;
}

echo "Import complete.\n";
echo "Created: $created | Updated: $updated | Skipped: $skipped\n";

/**
 * @return Asset|null
 */
function importFeaturedImage(string $url, int $volumeId, int $folderId): ?Asset
{
    $url = normalizeImageUrl($url);

    $path = parse_url($url, PHP_URL_PATH) ?: '';
    $filename = basename($path);
    if ($filename === '' || $filename === '/') {
        return null;
    }

    $filename = preg_replace('/[^A-Za-z0-9._-]/', '-', $filename);
    $filename = $filename ?: ('wp-image-' . md5($url) . '.jpg');

    $existing = Asset::find()
        ->volumeId($volumeId)
        ->folderId($folderId)
        ->filename($filename)
        ->one();
    if ($existing) {
        return $existing;
    }

    $binary = httpGet($url, true);
    if ($binary === false) {
        return null;
    }

    $tmpPath = Craft::$app->getPath()->getTempPath() . DIRECTORY_SEPARATOR . uniqid('wpimg_', true) . '_' . $filename;
    file_put_contents($tmpPath, $binary);

    $asset = new Asset();
    $asset->tempFilePath = $tmpPath;
    $asset->filename = $filename;
    $asset->newFolderId = $folderId;
    $asset->volumeId = $volumeId;
    $asset->uploaderId = 1;
    $asset->avoidFilenameConflicts = true;
    $asset->setScenario(Asset::SCENARIO_CREATE);

    if (!Craft::$app->getElements()->saveElement($asset, true, true, false)) {
        @unlink($tmpPath);
        return null;
    }

    return $asset;
}

function normalizeImageUrl(string $url): string
{
    $parts = parse_url($url);
    if (!$parts || !isset($parts['host'])) {
        return $url;
    }

    $host = strtolower($parts['host']);
    if ($host !== 'localhost' && $host !== '127.0.0.1') {
        return $url;
    }

    $scheme = $parts['scheme'] ?? 'http';
    $port = isset($parts['port']) ? ':' . $parts['port'] : '';
    $path = $parts['path'] ?? '';
    $query = isset($parts['query']) ? '?' . $parts['query'] : '';
    $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';

    return "{$scheme}://host.docker.internal{$port}{$path}{$query}{$fragment}";
}

/**
 * @param array<int,array<string,mixed>> $existingRows
 * @param array<int,array{label:string,url:string}> $newLinks
 * @return array<int,array<string,string>>
 */
function mergeResourceLinks(array $existingRows, array $newLinks): array
{
    $result = [];
    $seen = [];

    foreach ($existingRows as $row) {
        $url = trim((string)($row['col2'] ?? $row['url'] ?? ''));
        if ($url === '' || isset($seen[$url])) {
            continue;
        }
        $label = trim((string)($row['col1'] ?? $row['label'] ?? ''));
        $result[] = [
            'col1' => $label !== '' ? $label : defaultLabelFromUrl($url),
            'col2' => $url,
        ];
        $seen[$url] = true;
    }

    foreach ($newLinks as $link) {
        $url = trim($link['url']);
        if ($url === '' || isset($seen[$url])) {
            continue;
        }
        $result[] = [
            'col1' => $link['label'] !== '' ? $link['label'] : defaultLabelFromUrl($url),
            'col2' => $url,
        ];
        $seen[$url] = true;
    }

    return $result;
}

/**
 * @return array<int,array{label:string,url:string}>
 */
function extractLinks(string $html): array
{
    if (trim($html) === '') {
        return [];
    }

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();

    $links = [];
    $seen = [];

    foreach ($dom->getElementsByTagName('a') as $a) {
        $url = trim((string)$a->getAttribute('href'));
        if ($url === '' || isset($seen[$url])) {
            continue;
        }

        if (!preg_match('#^https?://#i', $url)) {
            continue;
        }

        $label = trim((string)$a->textContent);
        if ($label === '') {
            $label = defaultLabelFromUrl($url);
        }

        $links[] = ['label' => $label, 'url' => $url];
        $seen[$url] = true;
    }

    return $links;
}

function defaultLabelFromUrl(string $url): string
{
    $host = parse_url($url, PHP_URL_HOST);
    return $host ? "Open {$host}" : 'Open Link';
}

/**
 * @param array<int,array<string,string>> $rows
 * @return array<int,string>
 */
function resourceLinkLabels(array $rows): array
{
    $labels = [];
    foreach ($rows as $row) {
        $label = trim((string)($row['col1'] ?? $row['label'] ?? ''));
        if ($label !== '') {
            $labels[] = $label;
        }
    }

    return $labels;
}

function normalizeBodyText(string $html): string
{
    if (trim($html) === '') {
        return '';
    }

    $text = preg_replace('/<br\s*\/?>/i', "\n", $html) ?? $html;
    $text = preg_replace('/<\/(p|div|h[1-6]|li|ul|ol|blockquote|tr)>/i', "\n", $text) ?? $text;
    $text = strip_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = str_replace("\xC2\xA0", ' ', $text);
    $text = preg_replace("/[ \t]+/", ' ', $text) ?? $text;
    $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

    return trim($text);
}

/**
 * @param array<int,string> $labels
 */
function stripTrailingLinkLabels(string $text, array $labels): string
{
    if ($text === '' || $labels === []) {
        return $text;
    }

    $labelMap = [];
    foreach ($labels as $label) {
        $labelMap[mb_strtolower(trim($label))] = true;
    }

    $lines = preg_split("/\R/", $text) ?: [$text];
    while ($lines !== []) {
        $lastIndex = count($lines) - 1;
        $lastLine = trim((string)$lines[$lastIndex]);

        if ($lastLine === '') {
            array_pop($lines);
            continue;
        }

        if (!isset($labelMap[mb_strtolower($lastLine)])) {
            break;
        }

        array_pop($lines);
    }

    return trim(implode("\n", $lines));
}

/**
 * @return string|false
 */
function httpGet(string $url, bool $binary = false): string|false
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_USERAGENT, 'craft-wordpress-importer/1.0');
        if ($binary) {
            curl_setopt($ch, CURLOPT_BINARYTRANSFER, true);
        }
        $result = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($result === false || $status >= 400) {
            return false;
        }
        return $result;
    }

    return @file_get_contents($url);
}
