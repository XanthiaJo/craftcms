<?php
declare(strict_types=1);

use craft\elements\Entry;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$snapshotPath = dirname(__DIR__) . '/.db-sync/craft-local-20260531-220306.sql.gz';
if (!is_file($snapshotPath)) {
    fwrite(STDERR, "Snapshot not found: {$snapshotPath}\n");
    exit(1);
}

$dump = gzdecode((string)file_get_contents($snapshotPath));
if ($dump === false) {
    fwrite(STDERR, "Could not decompress snapshot.\n");
    exit(1);
}

$titleBySlug = [];
if (($insertPos = strpos($dump, 'INSERT INTO `elements_sites` VALUES ')) !== false) {
    $statement = substr($dump, $insertPos + strlen('INSERT INTO `elements_sites` VALUES '));
    $rows = '';
    $inQuote = false;
    $escape = false;
    $length = strlen($statement);

    for ($i = 0; $i < $length; $i++) {
        $char = $statement[$i];

        if ($inQuote) {
            $rows .= $char;
            if ($escape) {
                $escape = false;
                continue;
            }

            if ($char === '\\') {
                $escape = true;
                continue;
            }

            if ($char === "'") {
                $inQuote = false;
            }
            continue;
        }

        if ($char === "'") {
            $inQuote = true;
            $rows .= $char;
            continue;
        }

        if ($char === ';') {
            break;
        }

        $rows .= $char;
    }

    preg_match_all(
        "/\\((\\d+),(\\d+),(\\d+),'((?:[^'\\\\]|\\\\.)*)','((?:[^'\\\\]|\\\\.)*)','((?:[^'\\\\]|\\\\.)*)','((?:[^'\\\\]|\\\\.)*)',1,'((?:[^'\\\\]|\\\\.)*)','((?:[^'\\\\]|\\\\.)*)','((?:[^'\\\\]|\\\\.)*)'\\)/s",
        $rows,
        $matches,
        PREG_SET_ORDER
    );

    foreach ($matches as $row) {
        $title = stripcslashes($row[4]);
        $slug = stripcslashes($row[5]);
        if ($slug !== '' && $title !== '') {
            $titleBySlug[$slug] = $title;
        }
    }
}

if ($titleBySlug === []) {
    fwrite(STDERR, "No titles were recovered from the snapshot.\n");
    exit(1);
}

$entries = Entry::find()
    ->section('posts')
    ->type('post')
    ->site('*')
    ->status(null)
    ->orderBy(['id' => SORT_ASC])
    ->all();

$fallbackRows = (new craft\db\Query())
    ->select([
        'es.slug',
        'es.title',
    ])
    ->from(['e' => '{{%entries}}'])
    ->innerJoin(['el' => '{{%elements}}'], '[[el.id]]=[[e.id]]')
    ->innerJoin(['es' => '{{%elements_sites}}'], '[[es.elementId]]=[[e.id]]')
    ->where(['e.sectionId' => Craft::$app->entries->getSectionByHandle('posts')->id, 'e.typeId' => Craft::$app->entries->getEntryTypeByHandle('post')->id])
    ->andWhere(['not', ['es.title' => null]])
    ->andWhere(['<>', 'es.title', ''])
    ->distinct(true)
    ->all();

foreach ($fallbackRows as $row) {
    $slug = (string)($row['slug'] ?? '');
    $title = (string)($row['title'] ?? '');
    if ($slug !== '' && $title !== '' && (!isset($titleBySlug[$slug]) || $titleBySlug[$slug] === '')) {
        $titleBySlug[$slug] = $title;
    }
}

$updated = 0;
$skipped = 0;

foreach ($entries as $entry) {
    $title = $titleBySlug[$entry->slug] ?? null;
    if ($title === null) {
        $skipped++;
        continue;
    }

    if ($entry->title === $title) {
        $skipped++;
        continue;
    }

    $db = Craft::$app->getDb();
    $now = gmdate('Y-m-d H:i:s');
    $db->createCommand()->update(
        '{{%elements_sites}}',
        [
            'title' => $title,
            'dateUpdated' => $now,
        ],
        [
            'elementId' => $entry->id,
            'siteId' => $entry->siteId,
        ]
    )->execute();

    $db->createCommand()->update(
        '{{%elements}}',
        [
            'dateUpdated' => $now,
        ],
        [
            'id' => $entry->id,
        ]
    )->execute();

    if (method_exists(Craft::$app->getElements(), 'invalidateCachesForElement')) {
        Craft::$app->getElements()->invalidateCachesForElement($entry);
    }

    $updated++;
    echo $entry->id . "\t" . $entry->slug . "\t" . $title . PHP_EOL;
}

echo "Done. Updated: {$updated} | Skipped: {$skipped}" . PHP_EOL;
