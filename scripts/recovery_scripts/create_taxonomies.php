<?php
declare(strict_types=1);

use craft\elements\Category;
use craft\elements\Entry;
use craft\elements\Tag;
use craft\fieldlayoutelements\CustomField;
use craft\fields\Categories as CategoriesField;
use craft\fields\Tags as TagsField;
use craft\models\CategoryGroup;
use craft\models\CategoryGroup_SiteSettings;
use craft\models\TagGroup;
use craft\helpers\StringHelper;
use yii\base\InvalidConfigException;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$fieldsService = Craft::$app->getFields();
$elementsService = Craft::$app->getElements();

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

function getCategoryGroupByHandle(string $handle): ?CategoryGroup
{
    foreach (Craft::$app->getCategories()->getAllGroups() as $group) {
        if ($group->handle === $handle) {
            return $group;
        }
    }
    return null;
}

function getTagGroupByHandle(string $handle): ?TagGroup
{
    foreach (Craft::$app->getTags()->getAllTagGroups() as $group) {
        if ($group->handle === $handle) {
            return $group;
        }
    }
    return null;
}

function ensureCategoryGroup(string $handle, string $name, bool $hasUrls = true, ?string $uriFormat = 'category/{slug}', ?string $template = 'category'): CategoryGroup
{
    $categoriesService = Craft::$app->getCategories();
    $group = getCategoryGroupByHandle($handle);
    if (!$group) {
        $group = new CategoryGroup();
        $group->uid = StringHelper::UUID();
        $group->name = $name;
        $group->handle = $handle;
        $group->maxLevels = null;
        $group->defaultPlacement = CategoryGroup::DEFAULT_PLACEMENT_END;
    }

    $siteSettings = [];
    foreach (Craft::$app->getSites()->getAllSites() as $site) {
        $settings = new CategoryGroup_SiteSettings();
        $settings->siteId = $site->id;
        $settings->hasUrls = $hasUrls;
        $settings->uriFormat = $uriFormat;
        $settings->template = $template;
        $siteSettings[] = $settings;
    }
    $group->setSiteSettings($siteSettings);

    $layout = saveLayout([
        [
            'name' => 'Content',
            'uid' => 'f11f1ec7-2444-4bc4-9df8-b0f6d6e9d9f1',
            'elements' => [],
        ],
    ], Category::class);
    $group->setFieldLayout($layout);

    if (!$categoriesService->saveGroup($group)) {
        throw new InvalidConfigException('Could not save category group.');
    }

    return $group;
}

function ensureTagGroup(string $handle, string $name): TagGroup
{
    $tagsService = Craft::$app->getTags();
    $group = getTagGroupByHandle($handle);
    if (!$group) {
        $group = new TagGroup();
        $group->uid = StringHelper::UUID();
        $group->name = $name;
        $group->handle = $handle;
    }

    $layout = saveLayout([
        [
            'name' => 'Content',
            'uid' => 'f11f1ec7-2444-4bc4-9df8-b0f6d6e9d9f2',
            'elements' => [],
        ],
    ], Tag::class);
    $group->setFieldLayout($layout);

    if (!$tagsService->saveTagGroup($group)) {
        throw new InvalidConfigException('Could not save tag group.');
    }

    return $group;
}

function ensureCategoryTerm(CategoryGroup $group, string $title): Category
{
    $term = Category::find()->groupId($group->id)->title($title)->status(null)->one();
    if ($term) {
        return $term;
    }

    $term = new Category();
    $term->groupId = $group->id;
    $term->siteId = Craft::$app->getSites()->getCurrentSite()->id;
    $term->title = $title;
    if (!Craft::$app->getElements()->saveElement($term)) {
        throw new InvalidConfigException('Could not save category term: ' . $title);
    }

    return $term;
}

function ensureFieldLayoutElement(string $layoutFieldHandle, string $label): array
{
    $field = Craft::$app->getFields()->getFieldByHandle($layoutFieldHandle);
    if (!$field) {
        throw new InvalidConfigException("Missing field: $layoutFieldHandle");
    }

    return [
        'fieldUid' => $field->uid,
        'label' => $label,
    ];
}

// Category and tag groups
$categoryGroup = ensureCategoryGroup('postCategories', 'Categories');
$projectTypeGroup = ensureCategoryGroup('projectTypes', 'Project Types', false, null, null);
$tagGroup = ensureTagGroup('postTags', 'Tags');

// Entry fields
$postCategories = getOrCreateField('postCategories', 'Post Categories', CategoriesField::class);
$postCategories->searchable = false;
$postCategories->source = 'group:' . $categoryGroup->uid;
$postCategories->selectionLabel = null;
$postCategories->showSearchInput = true;
$postCategories->showSiteMenu = false;
$postCategories->allowSelfRelations = false;
$fieldsService->saveField($postCategories);

$projectTypes = getOrCreateField('projectTypes', 'Project Types', CategoriesField::class);
$projectTypes->searchable = false;
$projectTypes->source = 'group:' . $projectTypeGroup->uid;
$projectTypes->selectionLabel = null;
$projectTypes->showSearchInput = true;
$projectTypes->showSiteMenu = false;
$projectTypes->allowSelfRelations = false;
$projectTypes->maintainHierarchy = true;
$projectTypes->maxRelations = 1;
$fieldsService->saveField($projectTypes);

$postTags = getOrCreateField('postTags', 'Post Tags', TagsField::class);
$postTags->searchable = false;
$postTags->source = 'taggroup:' . $tagGroup->uid;
$postTags->selectionLabel = null;
$postTags->showSearchInput = false;
$postTags->showSiteMenu = false;
$fieldsService->saveField($postTags);

// Add fields to the Post entry type layout if missing.
$postEntryType = Craft::$app->getEntries()->getEntryTypeByHandle('post');
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

        $elements = [];
        foreach ($contentTab->getElements() as $element) {
            $elements[] = $element->toArray();
        }

        $append = [];
        if (!in_array($projectTypes->uid, $existing, true)) {
            $append[] = fieldLayoutElement($projectTypes->uid, 'Project Type');
        }
        if (!in_array($postCategories->uid, $existing, true)) {
            $append[] = fieldLayoutElement($postCategories->uid, 'Categories');
        }
        if (!in_array($postTags->uid, $existing, true)) {
            $append[] = fieldLayoutElement($postTags->uid, 'Tags');
        }

        if ($append) {
            $contentTabArray = [
                'name' => $contentTab->name,
                'uid' => $contentTab->uid,
                'elements' => array_merge($elements, $append),
            ];

            $newLayout = saveLayout([$contentTabArray], Entry::class);
            $postEntryType->setFieldLayout($newLayout);
            Craft::$app->getEntries()->saveEntryType($postEntryType, false);
        }
    }
}

// Seed category terms from the localhost snapshot.
$snapshotPath = dirname(__DIR__) . '/.tmp_localhost_posts.html';
if (is_file($snapshotPath)) {
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTMLFile($snapshotPath);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);
    $articles = $xpath->query("//article[contains(@class, 'blog-post') or contains(@class, 'post type-post')]");
    $categoryMap = [];

    foreach ($articles as $article) {
        $titleNode = $xpath->query(".//h2[contains(@class, 'post-title')]//a", $article)->item(0);
        if (!$titleNode) {
            continue;
        }

        $title = trim($titleNode->textContent);
        $terms = [];
        foreach ($xpath->query(".//div[contains(@class, 'post-categories')]//a", $article) as $termNode) {
            $termTitle = trim($termNode->textContent);
            if ($termTitle !== '') {
                $terms[] = $termTitle;
            }
        }

        if ($title !== '' && $terms) {
            $categoryMap[$title] = array_values(array_unique($terms));
        }
    }

    $createdTerms = [];
    foreach ($categoryMap as $postTitle => $termTitles) {
        $entry = Entry::find()->section('posts')->type('post')->title($postTitle)->one();
        if (!$entry) {
            continue;
        }

        $termIds = [];
        foreach ($termTitles as $termTitle) {
            if (!isset($createdTerms[$termTitle])) {
                $createdTerms[$termTitle] = ensureCategoryTerm($categoryGroup, $termTitle);
            }
            $termIds[] = $createdTerms[$termTitle]->id;
        }

        $entry->setFieldValue('postCategories', $termIds);
        $elementsService->saveElement($entry, true, true, false);
    }
}

echo "Taxonomies created.\n";
