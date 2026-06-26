<?php
/**
 * Imports post_content from the WordPress DB (misssponto) into Craft body + resourceLinks.
 *
 * Reads from the WordPress MySQL database loaded in DDEV, strips HTML/Elementor cruft,
 * extracts clean text for the body field and external links for resourceLinks.
 * Matches by title to existing Craft entries.
 */

require dirname(__DIR__, 2) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

use craft\elements\Entry;

// Query WordPress posts directly from the loaded DB
$pdo = new \PDO('mysql:host=db;dbname=misssponto;charset=utf8mb4', 'root', 'root');
$pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

$stmt = $pdo->prepare("SELECT ID, post_title, post_name, post_date, post_content FROM ZedPh_posts WHERE post_type = 'post' AND post_status = 'publish' ORDER BY post_date");
$stmt->execute();
$wpPosts = $stmt->fetchAll(\PDO::FETCH_ASSOC);

echo "Found " . count($wpPosts) . " published WordPress posts\n";

// Build title -> WP post map
$wpByTitle = [];
foreach ($wpPosts as $wp) {
    $normalized = normalizeTitle($wp['post_title']);
    $wpByTitle[$normalized] = $wp;
}

// Get all Craft posts
$craftEntries = Entry::find()
    ->section('posts')
    ->status(null)
    ->all();

echo "Found " . count($craftEntries) . " Craft entries\n\n";

$updated = 0;
$skipped = 0;
$noMatch = [];

foreach ($craftEntries as $entry) {
    $craftTitle = normalizeTitle($entry->title);

    if (!isset($wpByTitle[$craftTitle])) {
        $noMatch[] = $entry->title;
        $skipped++;
        continue;
    }

    $wp = $wpByTitle[$craftTitle];
    $html = $wp['post_content'];

    // Extract resource links (external <a> tags with visible text)
    $resourceLinks = extractResourceLinks($html);

    // Clean HTML to plain text for body
    $cleanContent = cleanHtmlToText($html);

    if (strlen($cleanContent) === 0 && count($resourceLinks) === 0) {
        echo "  SKIP (empty after cleaning): {$entry->title}\n";
        $skipped++;
        continue;
    }

    $entry->body = $cleanContent;

    // Set resource links if we found any
    if (count($resourceLinks) > 0) {
        $entry->setFieldValue('resourceLinks', $resourceLinks);
    }

    if (Craft::$app->getElements()->saveElement($entry, false)) {
        $linksCount = count($resourceLinks);
        echo "  UPDATED: {$entry->title} (" . strlen($cleanContent) . " chars, {$linksCount} resource links)\n";
        $updated++;
    } else {
        echo "  ERROR saving: {$entry->title}\n";
        foreach ($entry->getErrors() as $attr => $errors) {
            echo "    $attr: " . implode(', ', $errors) . "\n";
        }
        $skipped++;
    }
}

echo "\nDone: $updated updated, $skipped skipped\n";
if (count($noMatch) > 0) {
    echo "No WordPress match for: " . implode(', ', $noMatch) . "\n";
}

function normalizeTitle(string $title): string
{
    $t = mb_strtolower(trim($title));
    $t = str_replace(["\xE2\x80\x98", "\xE2\x80\x99", "\xE2\x80\x9C", "\xE2\x80\x9D", "\xE2\x80\xA6"], ["'", "'", '"', '"', "..."], $t);
    $t = preg_replace('/\s+/', ' ', $t);
    return $t;
}

function cleanHtmlToText(string $html): string
{
    // Remove <style>...</style> blocks
    $text = preg_replace('/<style[^>]*>.*?<\/style>/is', '', $html);

    // Remove <script>...</script> blocks
    $text = preg_replace('/<script[^>]*>.*?<\/script>/is', '', $text);

    // Remove WordPress shortcodes [shortcode...]
    $text = preg_replace('/\[[a-zA-Z][^\]]*\]/', '', $text);

    // Remove <img> tags (images are handled separately)
    $text = preg_replace('/<img[^>]*>/i', '', $text);

    // Remove <a> tags entirely (link text like "Pattern" is captured as resource links)
    $text = preg_replace('/<a\s+[^>]*>.*?<\/a>/is', '', $text);

    // Convert headings to text with newlines
    $text = preg_replace('/<h[1-6][^>]*>/i', "\n\n", $text);
    $text = preg_replace('/<\/h[1-6]>/i', "\n", $text);

    // Convert <p> and <br> to newlines
    $text = preg_replace('/<p[^>]*>/i', "\n\n", $text);
    $text = preg_replace('/<\/p>/i', "\n", $text);
    $text = preg_replace('/<br\s*\/?>/i', "\n", $text);

    // Convert <li> to bullet lines
    $text = preg_replace('/<li[^>]*>/i', "\n- ", $text);
    $text = preg_replace('/<\/li>/i', '', $text);

    // Remove all remaining HTML tags
    $text = strip_tags($text);

    // Decode HTML entities
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    // Normalize whitespace
    $lines = explode("\n", $text);
    $cleanLines = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line !== '') {
            $cleanLines[] = $line;
        }
    }

    // Join with single newlines
    $text = implode("\n", $cleanLines);

    // Collapse multiple spaces within lines
    $text = preg_replace('/[ \t]+/', ' ', $text);

    return trim($text);
}

function extractResourceLinks(string $html): array
{
    $links = [];

    // Match <a> tags with href and visible text
    if (!preg_match_all('/<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/is', $html, $matches, PREG_SET_ORDER)) {
        return $links;
    }

    $seen = [];
    foreach ($matches as $m) {
        $url = $m[1];
        $label = trim(strip_tags($m[2]));

        // Skip empty labels
        if ($label === '') continue;

        // Skip Elementor lightbox links
        if (preg_match('/elementor-action|lightbox/', $url)) continue;

        // Skip links to WordPress site's own uploads (image links)
        if (preg_match('/\/wp-content\/uploads\//', $url)) continue;

        // Skip duplicate URLs
        if (isset($seen[$url])) continue;
        $seen[$url] = true;

        // Only include external links that look like resource/pattern links
        // (not navigation or WordPress internal links)
        if (preg_match('/ravelry\.com|etsy\.com|amigurumi\.to|youtube\.com|youtu\.be|blogspot\.com|facebook\.com|instagram\.com|pinterest\.com/i', $url)
            || (preg_match('/^https?:\/\//', $url) && !preg_match('/awesome-einstein|misssponto\.me\.uk/', $url) && $label !== '')
        ) {
            $links[] = [
                'label' => $label,
                'url' => $url,
            ];
        }
    }

    return $links;
}
