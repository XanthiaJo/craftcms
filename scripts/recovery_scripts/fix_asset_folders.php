<?php
declare(strict_types=1);

use craft\elements\Asset;
use craft\elements\Entry;
use yii\db\Expression;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$volume = Craft::$app->getVolumes()->getVolumeByHandle('postImages');
if (!$volume) {
    fwrite(STDERR, "Volume 'postImages' not found.\n");
    exit(1);
}

$assetsService = Craft::$app->getAssets();
$db = Craft::$app->getDb();
$now = new Expression('NOW()');

$entries = Entry::find()
    ->section('posts')
    ->type('post')
    ->site('*')
    ->with(['featuredImage'])
    ->status(null)
    ->orderBy(['id' => SORT_ASC])
    ->all();

$updatedFolders = 0;
$updatedAssets = 0;

foreach ($entries as $entry) {
    $asset = $entry->featuredImage->one();
    if (!$asset instanceof Asset) {
        continue;
    }

    $folderKey = (string)($entry->canonicalId ?: $entry->id);
    $folder = $assetsService->ensureFolderByFullPathAndVolume($folderKey, $volume, true);
    if (!$folder) {
        fwrite(STDERR, "Failed to ensure folder for post {$folderKey}\n");
        continue;
    }

    $updatedFolders++;

    if ((int)$asset->folderId !== (int)$folder->id) {
        $db->createCommand()->update(
            'assets',
            [
                'folderId' => $folder->id,
                'dateUpdated' => $now,
            ],
            ['id' => $asset->id]
        )->execute();

        $updatedAssets++;
        echo "Moved asset #{$asset->id} ({$asset->filename}) to folder {$folderKey}\n";
    }
}

echo "Done. Folders ensured: {$updatedFolders} | Assets updated: {$updatedAssets}\n";
