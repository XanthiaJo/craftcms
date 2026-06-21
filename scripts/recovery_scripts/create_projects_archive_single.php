<?php
declare(strict_types=1);

use craft\elements\Entry;
use craft\fields\PlainText;
use craft\models\EntryType;
use craft\models\Section;
use craft\models\Section_SiteSettings;
use yii\base\InvalidConfigException;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$fieldsService = Craft::$app->getFields();
$entriesService = Craft::$app->getEntries();
$sitesService = Craft::$app->getSites();
$elementsService = Craft::$app->getElements();

function getOrCreateField(string $handle, string $name): \craft\base\Field
{
    $fieldsService = Craft::$app->getFields();
    $field = $fieldsService->getFieldByHandle($handle);
    if ($field) {
        return $field;
    }

    $field = new PlainText();
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

$heading = getOrCreateField('projectsArchiveHeading', 'Projects Archive Heading');
$heading->instructions = 'Main heading shown on the /posts archive page.';
$heading->searchable = false;
$heading->multiline = false;
$heading->code = false;
$heading->initialRows = 1;
$heading->placeholder = null;
$heading->uiMode = 'normal';
$heading->charLimit = null;
$heading->byteLimit = null;
$fieldsService->saveField($heading);

$metaDescription = getOrCreateField('projectsArchiveMetaDescription', 'Projects Archive Meta Description');
$metaDescription->instructions = 'Meta description used on the /posts archive page.';
$metaDescription->searchable = false;
$metaDescription->multiline = true;
$metaDescription->code = false;
$metaDescription->initialRows = 2;
$metaDescription->placeholder = null;
$metaDescription->uiMode = 'normal';
$metaDescription->charLimit = null;
$metaDescription->byteLimit = null;
$fieldsService->saveField($metaDescription);

$sidebarIntro = getOrCreateField('projectsArchiveSidebarIntro', 'Projects Archive Sidebar Intro');
$sidebarIntro->instructions = 'Short introduction shown above the archive filters.';
$sidebarIntro->searchable = false;
$sidebarIntro->multiline = true;
$sidebarIntro->code = false;
$sidebarIntro->initialRows = 3;
$sidebarIntro->placeholder = null;
$sidebarIntro->uiMode = 'normal';
$sidebarIntro->charLimit = null;
$sidebarIntro->byteLimit = null;
$fieldsService->saveField($sidebarIntro);

$entryType = $entriesService->getEntryTypeByHandle('projectsArchive');
if (!$entryType) {
    $entryType = new EntryType();
    $entryType->uid = 'fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c';
    $entryType->name = 'Projects Archive';
    $entryType->handle = 'projectsArchive';
    $entryType->hasTitleField = false;
    $entryType->showSlugField = false;
    $entryType->showStatusField = false;
    $entryType->titleFormat = null;
    $entryType->titleTranslationMethod = 'site';
    $entryType->slugTranslationMethod = 'site';
    $entryType->uiLabelFormat = '{title}';
}

$layout = saveLayout([
    [
        'name' => 'Content',
        'uid' => '74217325-3b5f-4de3-b521-1bafda0aa930',
        'elements' => [
            fieldLayoutElement($heading->uid, 'Heading'),
            fieldLayoutElement($metaDescription->uid, 'Meta Description'),
            fieldLayoutElement($sidebarIntro->uid, 'Sidebar Intro'),
        ],
    ],
], Entry::class);
$entryType->setFieldLayout($layout);
$entriesService->saveEntryType($entryType, false);

$section = $entriesService->getSectionByHandle('projectsArchive');
if (!$section) {
    $section = new Section([
        'uid' => '6a47cd07-ec9e-460f-999f-081f64ceeb62',
        'name' => 'Projects Archive',
        'handle' => 'projectsArchive',
        'type' => Section::TYPE_SINGLE,
        'enableVersioning' => true,
        'previewTargets' => [
            [
                'label' => 'Primary entry page',
                'urlFormat' => '{url}',
            ],
        ],
    ]);
}

$siteSettings = [];
foreach ($sitesService->getAllSites(true) as $site) {
    $siteSettings[] = new Section_SiteSettings([
        'siteId' => $site->id,
        'enabledByDefault' => true,
        'hasUrls' => true,
        'uriFormat' => 'posts',
        'template' => 'posts',
    ]);
}
$section->setSiteSettings($siteSettings);
$section->setEntryTypes([$entryType]);

if (!$entriesService->saveSection($section, false)) {
    throw new InvalidConfigException('Could not save Projects Archive section.');
}

$projectsArchiveEntry = craft\elements\Entry::find()
    ->section('projectsArchive')
    ->siteId($sitesService->getPrimarySite()->id)
    ->status(null)
    ->one();

if (!$projectsArchiveEntry) {
    throw new InvalidConfigException('Projects Archive single entry was not created.');
}

if (!$projectsArchiveEntry->title) {
    $projectsArchiveEntry->title = 'Projects Archive';
}

if (!$projectsArchiveEntry->getFieldValue('projectsArchiveHeading')) {
    $projectsArchiveEntry->setFieldValue('projectsArchiveHeading', 'Completed Projects');
}

if (!$projectsArchiveEntry->getFieldValue('projectsArchiveMetaDescription')) {
    $projectsArchiveEntry->setFieldValue('projectsArchiveMetaDescription', 'Completed handmade projects and past makes.');
}

if (!$projectsArchiveEntry->getFieldValue('projectsArchiveSidebarIntro')) {
    $projectsArchiveEntry->setFieldValue('projectsArchiveSidebarIntro', 'Browse the archive by project type, category, tag, or year.');
}

$elementsService->saveElement($projectsArchiveEntry, true, true, false);

echo "Projects archive single created or updated.\n";
