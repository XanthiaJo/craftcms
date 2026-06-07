<?php
declare(strict_types=1);

use yii\db\Expression;
use craft\elements\Asset;
use craft\db\Query;
use craft\elements\Entry;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$db = Craft::$app->getDb();
$now = new Expression('NOW()');

$fieldId = (int)(new Query())
    ->select('id')
    ->from('{{%fields}}')
    ->where(['handle' => 'featuredImage'])
    ->scalar();

if (!$fieldId) {
    fwrite(STDERR, "Could not find featuredImage field.\n");
    exit(1);
}

$relations = $db->createCommand(
    <<<SQL
    SELECT r.sourceId, r.targetId, e.canonicalId AS canonicalId
    FROM {{%relations}} r
    INNER JOIN {{%elements}} e ON e.id = r.sourceId
    WHERE r.fieldId = :fieldId
      AND e.canonicalId IS NOT NULL
      AND e.canonicalId <> e.id
    SQL
)->bindValue(':fieldId', $fieldId)->queryAll();

$elementsService = Craft::$app->getElements();
$primarySiteId = Craft::$app->getSites()->getPrimarySite()->id;
$seedAssetIdByCanonicalId = [];
$updatedFromRevisions = 0;

foreach ($relations as $relation) {
    $canonicalId = (int)$relation['canonicalId'];
    $targetId = (int)$relation['targetId'];
    if (!isset($seedAssetIdByCanonicalId[$canonicalId])) {
        $seedAssetIdByCanonicalId[$canonicalId] = $targetId;
    }
}

$canonicalEntries = Entry::find()
    ->section('posts')
    ->type('post')
    ->siteId($primarySiteId)
    ->status(null)
    ->orderBy(['id' => SORT_ASC])
    ->all();

$updatedEntries = [];
$updatedFromFolders = 0;
foreach ($canonicalEntries as $entry) {
    if ((int)$entry->canonicalId !== (int)$entry->id) {
        continue;
    }

    $existingAsset = $entry->featuredImage ? $entry->featuredImage->one() : null;
    if ($existingAsset) {
        continue;
    }

    $canonicalId = (int)$entry->id;
    $assetId = $seedAssetIdByCanonicalId[$canonicalId] ?? null;

    if (!$assetId) {
        $folderAsset = Asset::find()
            ->volume('postImages')
            ->siteId($primarySiteId)
            ->status(null)
            ->folderPath($canonicalId . '/')
            ->orderBy('id asc')
            ->one();
        $assetId = $folderAsset?->id;
    }

    if (!$assetId) {
        continue;
    }

    $title = $entry->title;
    $entry->setFieldValue('featuredImage', [$assetId]);
    $entry->title = $title;

    if (!$elementsService->saveElement($entry, false, true, false)) {
        $errors = json_encode($entry->getErrors(), JSON_UNESCAPED_SLASHES);
        fwrite(STDERR, "Could not save featured image for entry {$canonicalId}: {$errors}\n");
        continue;
    }

    $updatedEntries[$canonicalId] = true;
    if (isset($seedAssetIdByCanonicalId[$canonicalId])) {
        $updatedFromRevisions++;
    } else {
        $updatedFromFolders++;
    }
}

if (!empty($updatedEntries)) {
    $db->createCommand()->update(
        '{{%elements}}',
        ['dateUpdated' => $now],
        ['id' => array_keys($updatedEntries)]
    )->execute();

    $db->createCommand()->update(
        '{{%relations}}',
        ['sortOrder' => 1],
        [
            'and',
            ['fieldId' => $fieldId],
            ['sourceId' => array_keys($updatedEntries)],
            ['sortOrder' => null],
        ]
    )->execute();
}

echo "Restored {$updatedFromRevisions} featured images from revision relations and {$updatedFromFolders} from asset folders onto " . count($updatedEntries) . " canonical entries via Craft saves.\n";
