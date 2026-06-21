<?php
declare(strict_types=1);

use craft\elements\GlobalSet;
use craft\elements\Entry;
use craft\fields\Assets;
use craft\fields\Matrix;
use craft\fields\PlainText;
use craft\models\EntryType;
use yii\base\InvalidConfigException;

require dirname(__DIR__) . '/bootstrap.php';
$app = require CRAFT_VENDOR_PATH . '/craftcms/cms/bootstrap/console.php';

$fieldsService = Craft::$app->getFields();
$entriesService = Craft::$app->getEntries();
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

// Home fields
$homeHeading = getOrCreateField('homeHeading', 'Home Heading', PlainText::class);
$homeHeading->instructions = 'Main heading shown at the top of the homepage.';
$homeHeading->searchable = false;
$homeHeading->multiline = false;
$homeHeading->code = false;
$homeHeading->initialRows = 1;
$homeHeading->placeholder = null;
$homeHeading->uiMode = 'normal';
$homeHeading->charLimit = null;
$homeHeading->byteLimit = null;
$fieldsService->saveField($homeHeading);

$homeIntro = getOrCreateField('homeIntro', 'Home Intro', PlainText::class);
$homeIntro->instructions = 'Intro paragraph under the heading.';
$homeIntro->searchable = false;
$homeIntro->multiline = true;
$homeIntro->code = false;
$homeIntro->initialRows = 4;
$homeIntro->placeholder = null;
$homeIntro->uiMode = 'normal';
$homeIntro->charLimit = null;
$homeIntro->byteLimit = null;
$fieldsService->saveField($homeIntro);

$cardImage = getOrCreateField('homeCardImage', 'Home Card Image', Assets::class);
$cardImage->searchable = false;
$cardImage->allowUploads = true;
$cardImage->allowSubfolders = false;
$cardImage->allowSelfRelations = false;
$cardImage->defaultPlacement = 'end';
$cardImage->defaultUploadLocationSource = 'volume:56b64bf1-40b8-4808-a076-f845aced2527';
$cardImage->defaultUploadLocationSubpath = '{canonicalId}';
$cardImage->restrictedLocationSource = 'volume:56b64bf1-40b8-4808-a076-f845aced2527';
$cardImage->restrictedLocationSubpath = null;
$cardImage->restrictLocation = false;
$cardImage->restrictFiles = false;
$cardImage->sources = '*';
$cardImage->allowedKinds = null;
$cardImage->maxRelations = null;
$cardImage->minRelations = null;
$cardImage->previewMode = \craft\fields\Assets::PREVIEW_MODE_FULL;
$cardImage->showSearchInput = true;
$cardImage->showSiteMenu = true;
$cardImage->showUnpermittedFiles = false;
$cardImage->showUnpermittedVolumes = false;
$cardImage->targetSiteId = null;
$cardImage->validateRelatedElements = false;
$cardImage->viewMode = 'list';
$cardImage->selectionLabel = null;
$cardImage->maintainHierarchy = false;
$cardImage->branchLimit = null;
$cardImage->restrictedDefaultUploadSubpath = null;
$fieldsService->saveField($cardImage);

$cardText = getOrCreateField('homeCardText', 'Home Card Text', PlainText::class);
$cardText->instructions = 'Short description for the card.';
$cardText->searchable = false;
$cardText->multiline = true;
$cardText->code = false;
$cardText->initialRows = 3;
$cardText->placeholder = null;
$cardText->uiMode = 'normal';
$cardText->charLimit = null;
$cardText->byteLimit = null;
$fieldsService->saveField($cardText);

$cardLink = getOrCreateField('homeCardLink', 'Home Card Link', PlainText::class);
$cardLink->instructions = 'Optional link for the card, such as /posts or /holiday-2026.';
$cardLink->searchable = false;
$cardLink->multiline = false;
$cardLink->code = false;
$cardLink->initialRows = 1;
$cardLink->placeholder = '/your-page';
$cardLink->uiMode = 'normal';
$cardLink->charLimit = null;
$cardLink->byteLimit = null;
$fieldsService->saveField($cardLink);

// Matrix block entry type
$cardEntryType = $entriesService->getEntryTypeByHandle('homeCard');
if (!$cardEntryType) {
    $cardEntryType = new EntryType();
    $cardEntryType->uid = 'b1f1f6d9-8df9-4c8c-9c38-f5f055b6db00';
    $cardEntryType->name = 'Home Card';
    $cardEntryType->handle = 'homeCard';
    $cardEntryType->hasTitleField = true;
    $cardEntryType->showSlugField = false;
    $cardEntryType->showStatusField = false;
    $cardEntryType->titleFormat = null;
    $cardEntryType->titleTranslationMethod = 'site';
    $cardEntryType->slugTranslationMethod = 'site';
    $cardEntryType->uiLabelFormat = '{title}';

}

$cardLayout = saveLayout([
    [
        'name' => 'Content',
        'uid' => 'b8ae2d5a-8cf2-4dd2-8d2f-7b1c35e2e3f1',
        'elements' => [
            fieldLayoutElement($cardImage->uid, 'Image'),
            fieldLayoutElement($cardText->uid, 'Text'),
            fieldLayoutElement($cardLink->uid, 'Link'),
        ],
    ],
], Entry::class);
$cardEntryType->setFieldLayout($cardLayout);
$entriesService->saveEntryType($cardEntryType, false);

// Matrix field
$homeCards = $fieldsService->getFieldByHandle('homeCards');
if (!$homeCards) {
    $homeCards = new Matrix();
    $homeCards->name = 'Home Cards';
    $homeCards->handle = 'homeCards';
    $homeCards->searchable = false;
    $homeCards->viewMode = Matrix::VIEW_MODE_BLOCKS;
    $homeCards->includeTableView = false;
    $homeCards->pageSize = null;
    $homeCards->createButtonLabel = 'Add card';
    $homeCards->setEntryTypes([$cardEntryType]);
    $fieldsService->saveField($homeCards);
}

// Global set for homepage content
$homeSet = $globalsService->getSetByHandle('home');
if (!$homeSet) {
    $homeSet = new GlobalSet();
    $homeSet->uid = '4fb2b3ef-47c1-4d31-836a-5f8f7f0f8c2f';
    $homeSet->name = 'Home';
    $homeSet->handle = 'home';
}

$homeLayout = saveLayout([
    [
        'name' => 'Content',
        'uid' => '0d1a4c90-5a87-4f0c-a1d7-e3d6398b5e5f',
        'elements' => [
            fieldLayoutElement($homeHeading->uid, 'Heading'),
            fieldLayoutElement($homeIntro->uid, 'Intro'),
            fieldLayoutElement($homeCards->uid, 'Cards'),
        ],
    ],
], GlobalSet::class);
$homeSet->setFieldLayout($homeLayout);
$globalsService->saveSet($homeSet);

echo "Home content model created.\n";
