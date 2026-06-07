<?php
declare(strict_types=1);

use craft\fieldlayoutelements\CustomField;
use craft\elements\Entry;
use craft\fields\Categories as CategoriesField;
use craft\models\CategoryGroup;
use craft\models\CategoryGroup_SiteSettings;
use yii\base\InvalidConfigException;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$fieldsService = Craft::$app->getFields();
$entriesService = Craft::$app->getEntries();

function getCategoryGroupByHandle(string $handle): ?CategoryGroup
{
    foreach (Craft::$app->getCategories()->getAllGroups() as $group) {
        if ($group->handle === $handle) {
            return $group;
        }
    }
    return null;
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
        'type' => CustomField::class,
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

function ensureCategoryGroup(string $handle, string $name): CategoryGroup
{
    $categoriesService = Craft::$app->getCategories();
    $group = getCategoryGroupByHandle($handle);
    if (!$group) {
        $group = new CategoryGroup();
        $group->uid = \craft\helpers\StringHelper::UUID();
        $group->name = $name;
        $group->handle = $handle;
        $group->maxLevels = 1;
        $group->defaultPlacement = CategoryGroup::DEFAULT_PLACEMENT_END;
    }

    $siteSettings = [];
    foreach (Craft::$app->getSites()->getAllSites() as $site) {
        $settings = new CategoryGroup_SiteSettings();
        $settings->siteId = $site->id;
        $settings->hasUrls = false;
        $settings->uriFormat = null;
        $settings->template = null;
        $siteSettings[] = $settings;
    }
    $group->setSiteSettings($siteSettings);

    $layout = saveLayout([
        [
            'name' => 'Content',
            'uid' => 'f11f1ec7-2444-4bc4-9df8-b0f6d6e9d9f3',
            'elements' => [],
        ],
    ], \craft\elements\Category::class);
    $group->setFieldLayout($layout);

    if (!$categoriesService->saveGroup($group)) {
        throw new InvalidConfigException('Could not save design source category group.');
    }

    return $group;
}

$designSourceGroup = ensureCategoryGroup('designSources', 'Design Sources');

$designSourceField = $fieldsService->getFieldByHandle('designSource');
if (!$designSourceField) {
    $designSourceField = new CategoriesField();
    $designSourceField->name = 'Design Source';
    $designSourceField->handle = 'designSource';
}
$designSourceField->searchable = false;
$designSourceField->source = 'group:' . $designSourceGroup->uid;
$designSourceField->selectionLabel = null;
$designSourceField->showSearchInput = true;
$designSourceField->showSiteMenu = false;
$designSourceField->allowSelfRelations = false;
$designSourceField->maintainHierarchy = false;
$designSourceField->maxRelations = 1;
$fieldsService->saveField($designSourceField);

$postEntryType = $entriesService->getEntryTypeByHandle('post');
if ($postEntryType) {
    $layout = $postEntryType->getFieldLayout();
    $tabs = $layout->getTabs();
    $contentTab = $tabs[0] ?? null;

    if ($contentTab) {
        $existing = [];
        foreach ($contentTab->getElements() as $element) {
            if ($element instanceof craft\fieldlayoutelements\CustomField) {
                $existing[] = $element->fieldUid;
            }
        }

        if (!in_array($designSourceField->uid, $existing, true)) {
            $elements = [];
            $inserted = false;
            foreach ($contentTab->getElements() as $element) {
                $elements[] = $element->toArray();
                if (!$inserted && $element instanceof craft\fieldlayoutelements\CustomField && $element->fieldUid === 'c8ae7352-3ab5-47e7-b586-a001fbe07430') {
                    $elements[] = fieldLayoutElement($designSourceField->uid, 'Design Source');
                    $inserted = true;
                }
            }

            if (!$inserted) {
                $elements[] = fieldLayoutElement($designSourceField->uid, 'Design Source');
            }

            $contentTabArray = [
                'name' => $contentTab->name,
                'uid' => $contentTab->uid,
                'elements' => $elements,
            ];

            $newLayout = saveLayout([$contentTabArray], Entry::class);
            $postEntryType->setFieldLayout($newLayout);
            $entriesService->saveEntryType($postEntryType, false);
        }
    }
}

echo "Design Source taxonomy created.\n";
