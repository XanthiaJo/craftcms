<?php
declare(strict_types=1);

use craft\db\Query;
use craft\elements\Entry;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

const BODY_LAYOUT_UID = 'e25caf86-a917-4d74-bd83-09fd75ea4ba0';

$entries = Entry::find()
    ->section('posts')
    ->type('post')
    ->site('*')
    ->status(null)
    ->orderBy(['id' => SORT_ASC])
    ->all();

$updated = 0;
$skipped = 0;

foreach ($entries as $entry) {
    if ((int)$entry->canonicalId !== (int)$entry->id) {
        continue;
    }

    $preservedTitle = (string)$entry->title;

    $revisionRows = (new Query())
        ->select(['es.content'])
        ->from(['e' => '{{%elements}}'])
        ->innerJoin(['es' => '{{%elements_sites}}'], '[[es.elementId]] = [[e.id]]')
        ->where(['e.canonicalId' => $entry->id, 'es.siteId' => $entry->siteId])
        ->andWhere(['<>', 'e.id', $entry->id])
        ->andWhere(['not', ['es.content' => null]])
        ->all();

    $htmlBody = '';
    foreach ($revisionRows as $row) {
        $content = json_decode((string)$row['content'], true);
        if (!is_array($content)) {
            continue;
        }

        $candidate = (string)($content[BODY_LAYOUT_UID] ?? '');
        if ($candidate !== '') {
            $htmlBody = $candidate;
            break;
        }
    }

    if ($htmlBody === '') {
        $skipped++;
        continue;
    }

    $resourceLinks = extractLinks($htmlBody);
    $cleanBody = stripTrailingLinkLabels(
        normalizeBodyText($htmlBody),
        resourceLinkLabels($resourceLinks)
    );

    $existingBody = trim((string)($entry->body ?? ''));
    $existingRows = is_array($entry->resourceLinks ?? null) ? $entry->resourceLinks : [];

    if ($existingBody === $cleanBody && serialize($existingRows) === serialize($resourceLinks)) {
        $skipped++;
        continue;
    }

    $entry->setFieldValue('body', $cleanBody);
    $entry->setFieldValue('resourceLinks', $resourceLinks);
    $entry->title = $preservedTitle;

    if (!Craft::$app->getElements()->saveElement($entry, true, true, false)) {
        fwrite(STDERR, "Failed to save entry #{$entry->id} ({$entry->slug})\n");
        fwrite(STDERR, print_r($entry->getErrors(), true));
        continue;
    }

    $updated++;
    echo $entry->id . "\t" . $entry->slug . "\t" . strlen($cleanBody) . "\t" . count($resourceLinks) . PHP_EOL;
}

echo "Done. Updated: {$updated} | Skipped: {$skipped}" . PHP_EOL;

/**
 * @return array<int,array{col1:string,col2:string}>
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
        if ($url === '' || isset($seen[$url]) || !preg_match('#^https?://#i', $url)) {
            continue;
        }

        $label = trim((string)$a->textContent);
        if ($label === '') {
            $label = defaultLabelFromUrl($url);
        }

        $links[] = [
            'col1' => $label,
            'col2' => $url,
        ];
        $seen[$url] = true;
    }

    return $links;
}

/**
 * @param array<int,array{col1:string,col2:string}> $rows
 * @return array<int,string>
 */
function resourceLinkLabels(array $rows): array
{
    $labels = [];
    foreach ($rows as $row) {
        $label = trim((string)($row['col1'] ?? ''));
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
    $text = preg_replace('/<\/(p|div|h[1-6]|li|ul|ol|blockquote|tr|section)>/i', "\n", $text) ?? $text;
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

function defaultLabelFromUrl(string $url): string
{
    $host = parse_url($url, PHP_URL_HOST);
    return $host ? "Open {$host}" : 'Open Link';
}
