<?php
declare(strict_types=1);

use craft\elements\Entry;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$sectionHandle = 'posts';
$entryTypeHandle = 'post';

$entries = Entry::find()
    ->section($sectionHandle)
    ->type($entryTypeHandle)
    ->status(null)
    ->site('*')
    ->all();

$updated = 0;
$unchanged = 0;

foreach ($entries as $entry) {
    $originalBody = (string)($entry->body ?? '');
    $existingRows = is_array($entry->resourceLinks ?? null) ? $entry->resourceLinks : [];
    $mergedRows = mergeResourceLinks($existingRows, extractLinks($originalBody));
    $cleanBody = stripTrailingLinkLabels(
        normalizeBodyText($originalBody),
        resourceLinkLabels($mergedRows)
    );

    $bodyChanged = $cleanBody !== $originalBody;
    $linksChanged = serialize($mergedRows) !== serialize($existingRows);

    if (!$bodyChanged && !$linksChanged) {
        $unchanged++;
        continue;
    }

    $entry->setFieldValue('body', $cleanBody);
    $entry->setFieldValue('resourceLinks', $mergedRows);

    if (!Craft::$app->getElements()->saveElement($entry, true, true, false)) {
        fwrite(STDERR, "Failed to save entry #{$entry->id} ({$entry->title})\n");
        fwrite(STDERR, print_r($entry->getErrors(), true));
        continue;
    }

    $updated++;
    echo "Updated #{$entry->id}: {$entry->title}\n";
}

echo "Done. Updated: {$updated} | Unchanged: {$unchanged}\n";

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
 * Remove trailing standalone lines that duplicate resource-link labels.
 *
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
