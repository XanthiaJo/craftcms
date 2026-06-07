<?php
declare(strict_types=1);

use craft\elements\GlobalSet;
use craft\fields\PlainText;
use craft\fields\Table;
use yii\base\InvalidConfigException;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$fieldsService = Craft::$app->getFields();
$globalsService = Craft::$app->getGlobals();

function getOrCreateField(string $handle, string $name, string $class): \craft\base\Field
{
    $fieldsService = Craft::$app->getFields();
    $field = $fieldsService->getFieldByHandle($handle);
    if ($field) {
        return $field;
    }

    $field = new $class();
    $field->name = $name;
    $field->handle = $handle;
    return $field;
}

function saveLayout(array $tabs, string $typeClass): \craft\models\FieldLayout
{
    $layout = Craft::$app->getFields()->createLayout([
        'tabs' => $tabs,
    ]);
    $layout->type = $typeClass;
    if (!Craft::$app->getFields()->saveLayout($layout, false)) {
        throw new InvalidConfigException('Could not save field layout.');
    }
    return $layout;
}

function fieldLayoutElement(string $fieldUid, ?string $label = null): array
{
    $config = [
        'type' => craft\fieldlayoutelements\CustomField::class,
        'fieldUid' => $fieldUid,
        'required' => false,
        'width' => 100,
        'dateAdded' => gmdate('c'),
    ];
    if ($label !== null) {
        $config['label'] = $label;
    }
    return $config;
}

$siteName = getOrCreateField('siteName', 'Site Name', PlainText::class);
$siteName->instructions = 'Brand name shown in the top bar.';
$siteName->searchable = false;
$siteName->multiline = false;
$siteName->code = false;
$siteName->initialRows = 1;
$siteName->placeholder = null;
$siteName->uiMode = 'normal';
$siteName->charLimit = null;
$siteName->byteLimit = null;
$fieldsService->saveField($siteName);

$siteNavigation = getOrCreateField('siteNavigation', 'Site Navigation', Table::class);
$siteNavigation->instructions = 'Top navigation links shown site-wide.';
$siteNavigation->searchable = false;
$siteNavigation->addRowLabel = 'Add a link';
$siteNavigation->columns = [
    'col1' => [
        'heading' => 'Label',
        'handle' => 'label',
        'width' => '',
        'type' => 'singleline',
    ],
    'col2' => [
        'heading' => 'URL',
        'handle' => 'url',
        'width' => '',
        'type' => 'url',
    ],
];
$siteNavigation->defaults = [
    [
        'col1' => 'Home',
        'col2' => '/',
        'rowId' => '7a39f7c8-5d75-49b3-92eb-f6f8f3e2ff01',
    ],
    [
        'col1' => 'Completed Projects',
        'col2' => '/posts',
        'rowId' => '8cc6b4cf-5142-4f57-9c95-fb0c8d0d9e6a',
    ],
];
$siteNavigation->minRows = null;
$siteNavigation->maxRows = null;
$siteNavigation->staticRows = false;
$fieldsService->saveField($siteNavigation);

$siteHeader = $globalsService->getSetByHandle('siteHeader');
if (!$siteHeader) {
    $siteHeader = new GlobalSet();
    $siteHeader->uid = '7c6b1435-4697-4f69-89da-0f52489f40c7';
    $siteHeader->name = 'Site Header';
    $siteHeader->handle = 'siteHeader';
}

$headerLayout = saveLayout([
    [
        'name' => 'Content',
        'uid' => 'd6c4efb6-9421-48c8-89b4-6a9f1c15ef1e',
        'elements' => [
            fieldLayoutElement($siteName->uid, 'Site Name'),
            fieldLayoutElement($siteNavigation->uid, 'Navigation'),
        ],
    ],
], GlobalSet::class);
$siteHeader->setFieldLayout($headerLayout);
$globalsService->saveSet($siteHeader);

$siteHeader = $globalsService->getSetByHandle('siteHeader');
if ($siteHeader) {
    $siteHeader->setFieldValue('siteName', 'Spontaneous Miscellaneous');
    $siteHeader->setFieldValue('siteNavigation', [
        ['label' => 'Home', 'url' => '/'],
        ['label' => 'Completed Projects', 'url' => '/posts'],
    ]);
    Craft::$app->getElements()->saveElement($siteHeader, true, true, false);
}

echo "Site header content model created.\n";
