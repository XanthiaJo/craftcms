<?php
declare(strict_types=1);

use craft\db\Query;
use yii\db\Expression;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$db = Craft::$app->getDb();
$now = new Expression('NOW()');
$fieldHandles = ['postCategories', 'postTags'];
$totalRestored = 0;
$touchedEntries = [];

foreach ($fieldHandles as $fieldHandle) {
    $fieldId = (int)(new Query())
        ->select('id')
        ->from('{{%fields}}')
        ->where(['handle' => $fieldHandle])
        ->scalar();

    if (!$fieldId) {
        fwrite(STDERR, "Skipping missing field: {$fieldHandle}\n");
        continue;
    }

    $relations = $db->createCommand(
        <<<SQL
        SELECT
            r.sourceId,
            r.sourceSiteId,
            r.targetId,
            r.sortOrder,
            e.canonicalId AS canonicalId
        FROM {{%relations}} r
        INNER JOIN {{%elements}} e ON e.id = r.sourceId
        WHERE r.fieldId = :fieldId
          AND e.canonicalId IS NOT NULL
          AND e.canonicalId <> e.id
        ORDER BY e.canonicalId, r.sortOrder
        SQL
    )->bindValue(':fieldId', $fieldId)->queryAll();

    $restoredForField = 0;

    foreach ($relations as $relation) {
        $canonicalId = (int)$relation['canonicalId'];
        $targetId = (int)$relation['targetId'];
        $sourceSiteId = $relation['sourceSiteId'] !== null ? (int)$relation['sourceSiteId'] : null;
        $sortOrder = $relation['sortOrder'] !== null ? (int)$relation['sortOrder'] : null;

        $existing = (new Query())
            ->from('{{%relations}}')
            ->where([
                'fieldId' => $fieldId,
                'sourceId' => $canonicalId,
                'targetId' => $targetId,
            ])
            ->scalar();

        if ($existing !== false) {
            continue;
        }

        $db->createCommand()->insert('{{%relations}}', [
            'fieldId' => $fieldId,
            'sourceId' => $canonicalId,
            'sourceSiteId' => $sourceSiteId,
            'targetId' => $targetId,
            'sortOrder' => $sortOrder,
        ])->execute();

        $restoredForField++;
        $touchedEntries[$canonicalId] = true;
    }

    $totalRestored += $restoredForField;
    echo "Restored {$restoredForField} {$fieldHandle} relations onto canonical posts.\n";
}

foreach (array_keys($touchedEntries) as $entryId) {
    $db->createCommand()->update(
        '{{%elements}}',
        ['dateUpdated' => $now],
        ['id' => $entryId]
    )->execute();
}

echo 'Updated ' . count($touchedEntries) . " canonical posts.\n";
