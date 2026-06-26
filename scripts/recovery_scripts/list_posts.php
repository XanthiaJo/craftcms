<?php
require dirname(__DIR__, 2) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$entries = \craft\elements\Entry::find()
    ->section('posts')
    ->status(null)
    ->orderBy('postDate asc')
    ->all();

echo count($entries) . " posts found\n";
echo str_repeat('=', 120) . "\n";

foreach ($entries as $e) {
    $bodyLen = $e->body ? strlen($e->body) : 0;
    $hasFeatured = $e->featuredImage ? $e->featuredImage->count() : 0;
    $hasPostImages = $e->postImages ? $e->postImages->count() : 0;
    $hasResourceLinks = $e->resourceLinks ? count($e->resourceLinks) : 0;
    $projectTypes = $e->projectTypes ? $e->projectTypes->count() : 0;
    $categories = $e->postCategories ? $e->postCategories->count() : 0;
    $tags = $e->postTags ? $e->postTags->count() : 0;
    $designSource = $e->designSource ? $e->designSource->count() : 0;

    echo sprintf(
        "ID=%d | slug=%s | title=%s | date=%s | body=%d chars | featImg=%d | postImg=%d | resLinks=%d | projType=%d | cats=%d | tags=%d | designSrc=%d\n",
        $e->id,
        $e->slug,
        $e->title,
        $e->postDate ? $e->postDate->format('Y-m-d') : 'null',
        $bodyLen,
        $hasFeatured,
        $hasPostImages,
        $hasResourceLinks,
        $projectTypes,
        $categories,
        $tags,
        $designSource
    );
}
