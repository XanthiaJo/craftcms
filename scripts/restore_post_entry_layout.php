<?php
declare(strict_types=1);

use craft\db\Query;
use yii\db\Expression;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$yamlPath = dirname(__DIR__) . '/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml';

if (!class_exists(\Symfony\Component\Yaml\Yaml::class)) {
    fwrite(STDERR, "Symfony YAML component is not available.\n");
    exit(1);
}

$parsed = \Symfony\Component\Yaml\Yaml::parseFile($yamlPath);
$fieldLayouts = $parsed['fieldLayouts'] ?? null;
if (!is_array($fieldLayouts) || !$fieldLayouts) {
    fwrite(STDERR, "No fieldLayouts found in {$yamlPath}.\n");
    exit(1);
}

$layoutConfig = array_values($fieldLayouts)[0];

$entryType = Craft::$app->getEntries()->getEntryTypeByHandle('post');
if (!$entryType) {
    fwrite(STDERR, "Post entry type not found.\n");
    exit(1);
}

$db = Craft::$app->getDb();
$db->createCommand()->update(
    '{{%fieldlayouts}}',
    [
        'config' => $layoutConfig,
        'dateUpdated' => new Expression('NOW()'),
    ],
    ['id' => $entryType->fieldLayoutId]
)->execute();

echo "Updated field layout {$entryType->fieldLayoutId} from project config.\n";
