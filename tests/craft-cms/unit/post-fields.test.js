const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const postEntryType = read('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml');
const postTemplate = read('templates/_entries/post.twig');
const postsArchiveTemplate = read('templates/posts.twig');

// ─── Entry type config: built-in fields ───────────────────────────────

test('post entry type has the required built-in fields editable in admin', () => {
  assert.match(postEntryType, /type:\s*craft\\fieldlayoutelements\\entries\\EntryTitleField/);
  assert.match(postEntryType, /required:\s*true/);
  assert.match(postEntryType, /hasTitleField:\s*true/);
  assert.match(postEntryType, /showSlugField:\s*true/);
  assert.match(postEntryType, /showStatusField:\s*true/);
});

// ─── Field config: type, handle, name for every post field ────────────

test('featuredImage field is an Assets field with the correct handle and name', () => {
  const field = read('config/project/fields/featuredImage--29579835-63db-4481-b347-52f1852e0eb9.yaml');
  assert.match(field, /^handle:\s*featuredImage$/m);
  assert.match(field, /^name:\s*'Featured Image'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Assets$/m);
});

test('body field is a PlainText field with the correct handle and name', () => {
  const field = read('config/project/fields/body--af6550e1-b206-4dcc-a2ff-a847082b77bc.yaml');
  assert.match(field, /^handle:\s*body$/m);
  assert.match(field, /^name:\s*Body$/m);
  assert.match(field, /^type:\s*craft\\fields\\PlainText$/m);
  assert.match(field, /multiline:\s*true/);
});

test('instructions field is a Matrix field with the instructionSection entry type', () => {
  const field = read('config/project/fields/instructions--53cdc25e-21c1-4998-a258-79e3ec30f36c.yaml');
  assert.match(field, /^handle:\s*instructions$/m);
  assert.match(field, /^name:\s*Instructions$/m);
  assert.match(field, /^type:\s*craft\\fields\\Matrix$/m);
  assert.match(field, /uid\n\s+- e507c3b9-be64-43ba-8f46-f3630adbaa68/);
});

test('instructionSection entry type has heading, subheading, text, and nested steps fields', () => {
  const entryType = read('config/project/entryTypes/instructionSection--e507c3b9-be64-43ba-8f46-f3630adbaa68.yaml');
  assert.match(entryType, /handle:\s*instructionSection/);
  assert.match(entryType, /fieldUid:\s*de28d2f7-8a33-44e7-801e-e65a0c589c14/);
  assert.match(entryType, /fieldUid:\s*c00d971d-29eb-48e9-af14-1438acd199a0/);
  assert.match(entryType, /fieldUid:\s*3b128811-957e-40d4-aeb7-ca8c63f7e1de/);
  assert.match(entryType, /fieldUid:\s*770e7672-f720-4f28-8d28-ec42a350e7c8/);
});

test('instructionSteps field is a nested Matrix field with the instructionStep entry type', () => {
  const field = read('config/project/fields/instructionSteps--770e7672-f720-4f28-8d28-ec42a350e7c8.yaml');
  assert.match(field, /^handle:\s*instructionSteps$/m);
  assert.match(field, /^name:\s*'Instruction Steps'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Matrix$/m);
  assert.match(field, /uid\n\s+- e658df5a-6730-4006-8252-088fed617ae2/);
});

test('instructionStep entry type has heading and text blocks matrix fields', () => {
  const entryType = read('config/project/entryTypes/instructionStep--e658df5a-6730-4006-8252-088fed617ae2.yaml');
  assert.match(entryType, /handle:\s*instructionStep/);
  assert.match(entryType, /fieldUid:\s*2eeb9770-728d-420e-8988-faf46168b929/);
  assert.match(entryType, /fieldUid:\s*88e54dd6-f463-4cc9-9d1f-a3014a370157/);
  assert.doesNotMatch(entryType, /fieldUid:\s*961722dc-6fd7-4b48-a2bf-e4d0162ece37/);
});

test('instructionStepTextBlock entry type has text and image fields', () => {
  const entryType = read('config/project/entryTypes/instructionStepTextBlock--ade117cc-4dd2-4d57-a69a-4742a3be244d.yaml');
  assert.match(entryType, /handle:\s*instructionStepTextBlock/);
  assert.match(entryType, /fieldUid:\s*032a993a-a5cc-43f7-8810-a33f792f56fe/);
  assert.match(entryType, /fieldUid:\s*d998cee5-1798-49ad-9624-6db8706315c2/);
});

test('instructionStepTexts field is a Matrix field with the instructionStepTextBlock entry type', () => {
  const field = read('config/project/fields/instructionStepTexts--88e54dd6-f463-4cc9-9d1f-a3014a370157.yaml');
  assert.match(field, /^handle:\s*instructionStepTexts$/m);
  assert.match(field, /^name:\s*'Text Blocks'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Matrix$/m);
  assert.match(field, /uid\n\s+- ade117cc-4dd2-4d57-a69a-4742a3be244d/);
});

test('instructionStepImage field allows multiple assets per step', () => {
  const field = read('config/project/fields/instructionStepImage--961722dc-6fd7-4b48-a2bf-e4d0162ece37.yaml');
  assert.match(field, /^handle:\s*instructionStepImage$/m);
  assert.match(field, /^type:\s*craft\\fields\\Assets$/m);
  assert.match(field, /maxRelations:\s*null/);
});

test('resourceLinks field is a Table field with label and url columns', () => {
  const field = read('config/project/fields/resourceLinks--76c53e19-a060-468b-9dcb-6f2874cdcde4.yaml');
  assert.match(field, /^handle:\s*resourceLinks$/m);
  assert.match(field, /^name:\s*'Resource Links'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Table$/m);
  assert.match(field, /- heading\n\s*- Label/);
  assert.match(field, /- handle\n\s*- label/);
  assert.match(field, /- heading\n\s*- URL/);
  assert.match(field, /- handle\n\s*- url/);
});

test('postImages field is an Assets field with the correct handle and name', () => {
  const field = read('config/project/fields/postImages--895989d9-cefc-4582-bbad-6736c0c471b8.yaml');
  assert.match(field, /^handle:\s*postImages$/m);
  assert.match(field, /^name:\s*'Post Images'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Assets$/m);
});

test('projectTypes field is a Categories field with the correct handle and name', () => {
  const field = read('config/project/fields/projectTypes--c8ae7352-3ab5-47e7-b586-a001fbe07430.yaml');
  assert.match(field, /^handle:\s*projectTypes$/m);
  assert.match(field, /^name:\s*'Project Types'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Categories$/m);
  assert.match(field, /maintainHierarchy:\s*true/);
});

test('postCategories field is a Categories field with the correct handle and name', () => {
  const field = read('config/project/fields/postCategories--52d25c97-f091-4cfb-84f6-e2529d60f743.yaml');
  assert.match(field, /^handle:\s*postCategories$/m);
  assert.match(field, /^name:\s*'Post Categories'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Categories$/m);
});

test('postTags field is a Tags field with the correct handle and name', () => {
  const field = read('config/project/fields/postTags--5cfa4a6e-5fa2-43f3-a646-d35ea81d5d63.yaml');
  assert.match(field, /^handle:\s*postTags$/m);
  assert.match(field, /^name:\s*'Post Tags'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Tags$/m);
});

test('designSource field is a Categories field limited to 1 relation', () => {
  const field = read('config/project/fields/designSource--dd7373ee-b1ce-4c8d-815d-03cfaed9bd88.yaml');
  assert.match(field, /^handle:\s*designSource$/m);
  assert.match(field, /^name:\s*'Design Source'$/m);
  assert.match(field, /^type:\s*craft\\fields\\Categories$/m);
  assert.match(field, /maxRelations:\s*1/);
});

// ─── Entry type config: all custom fields present in the layout ───────

test('post entry type layout includes every custom field by UID', () => {
  const uids = {
    'Featured Image': '29579835-63db-4481-b347-52f1852e0eb9',
    'Body': 'af6550e1-b206-4dcc-a2ff-a847082b77bc',
    'Instructions': '53cdc25e-21c1-4998-a258-79e3ec30f36c',
    'Resource Links': '76c53e19-a060-468b-9dcb-6f2874cdcde4',
    'Post Images': '895989d9-cefc-4582-bbad-6736c0c471b8',
    'Project Types': 'c8ae7352-3ab5-47e7-b586-a001fbe07430',
    'Post Categories': '52d25c97-f091-4cfb-84f6-e2529d60f743',
    'Post Tags': '5cfa4a6e-5fa2-43f3-a646-d35ea81d5d63',
    'Design Source': 'dd7373ee-b1ce-4c8d-815d-03cfaed9bd88',
  };
  for (const [label, uid] of Object.entries(uids)) {
    assert.match(postEntryType, new RegExp(`fieldUid:\\s*${uid}\\s*#\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
});

// ─── Single post template: every field rendered ───────────────────────

test('single post template renders the title', () => {
  assert.match(postTemplate, /<h1>\{\{\s*entry\.title\s*\}\}<\/h1>/);
});

test('single post template renders the featured image', () => {
  assert.match(postTemplate, /entry\.featuredImage\s*\?\s*entry\.featuredImage\.one\(\)\s*:\s*null/);
  assert.match(postTemplate, /<img class="thumb" src="\{\{\s*featuredImage\.url\s*\}\}" alt="\{\{\s*featuredImage\.title\s*\?:\s*entry\.title\s*\}\}">/);
});

test('single post template renders the post date', () => {
  assert.match(postTemplate, /entry\.postDate\|date\('F j, Y'\)/);
});

test('single post template renders the body content', () => {
  assert.match(postTemplate, /entry\.body/);
  assert.match(postTemplate, /entry\.body\|nl2br/);
});

test('single post template renders the instructions matrix with nested sections', () => {
  assert.match(postTemplate, /attribute\(entry,\s*'instructions'\)/);
  assert.match(postTemplate, /entry\.instructions\s*\?\s*entry\.instructions\.all\(\)/);
  assert.match(postTemplate, /class="instructions"/);
  assert.match(postTemplate, /instructionSections/);
  assert.match(postTemplate, /section\.instructionSectionHeading/);
  assert.match(postTemplate, /section\.instructionSectionSubheading/);
  assert.match(postTemplate, /section\.instructionSectionText\|nl2br/);
  assert.match(postTemplate, /section\.instructionSteps\s*\?\s*section\.instructionSteps\.all\(\)/);
  assert.match(postTemplate, /class="panel-sections"/);
  assert.match(postTemplate, /class="panel-section"/);
  assert.match(postTemplate, /<ol>/);
  assert.match(postTemplate, /<li>/);
  assert.match(postTemplate, /step\.instructionStepTexts\s*\?\s*step\.instructionStepTexts\.all\(\)/);
  assert.match(postTemplate, /for\s+textBlock\s+in\s+textBlocks/);
  assert.match(postTemplate, /<ol>/);
  assert.match(postTemplate, /textBlock\.instructionStepTextLine\|nl2br/);
  assert.match(postTemplate, /textBlock\.instructionStepTextImage\s*\?\s*textBlock\.instructionStepTextImage\.all\(\)/);
  assert.match(postTemplate, /for\s+blockImage\s+in\s+blockImages/);
  assert.match(postTemplate, /<div\s+class="gallery">/);
  assert.match(postTemplate, /<img\s+class="gallery-image"\s+src="\{\{\s*blockImage\.url\s*\}\}"\s+alt="\{\{\s*blockImage\.title\s*\?:\s*textBlock\.instructionStepTextLine\s*\?:\s*'Instruction image'\s*\}\}"\s+data-full="\{\{\s*blockImage\.url\s*\}\}">/);
});

test('single post template renders the post images gallery', () => {
  assert.match(postTemplate, /attribute\(entry,\s*'postImages'\)/);
  assert.match(postTemplate, /entry\.postImages\s*\?\s*entry\.postImages\.all\(\)/);
  assert.match(postTemplate, /class="gallery"/);
  assert.match(postTemplate, /<img class="gallery-image" src="\{\{\s*galleryImage\.url\s*\}\}" alt="\{\{\s*galleryImage\.title\s*\?:\s*entry\.title\s*\}\}"\s+data-full="\{\{\s*galleryImage\.url\s*\}\}">/);
});

test('single post template renders resource links as buttons in the sidebar', () => {
  assert.match(postTemplate, /attribute\(entry,\s*'resourceLinks'\)/);
  assert.match(postTemplate, /entry\.resourceLinks\|length/);
  assert.match(postTemplate, /row\.url\s*\?\?\s*row\.col2/);
  assert.match(postTemplate, /row\.label\s*\?\?\s*row\.col1/);
  assert.match(postTemplate, /<a class="button button-primary" href="\{\{\s*url\s*\}\}" target="_blank" rel="noopener">\{\{\s*label\s*\}\}<\/a>/);
  assert.match(postTemplate, /'Links',\s*html:\s*resourceLinksSidebarHtml/);
});

test('single post template renders project types in the sidebar', () => {
  assert.match(postTemplate, /attribute\(entry,\s*'projectTypes'\)/);
  assert.match(postTemplate, /entry\.projectTypes\s*\?\s*entry\.projectTypes\.all\(\)/);
  assert.match(postTemplate, /\?projectType\[\]=\{\{\s*projectType\.slug\|url_encode\s*\}\}/);
  assert.match(postTemplate, /'Project Type',\s*html:\s*projectTypesSidebarHtml/);
});

test('single post template renders categories in the sidebar', () => {
  assert.match(postTemplate, /attribute\(entry,\s*'postCategories'\)/);
  assert.match(postTemplate, /entry\.postCategories\s*\?\s*entry\.postCategories\.all\(\)/);
  assert.match(postTemplate, /\?category\[\]=\{\{\s*category\.slug\|url_encode\s*\}\}/);
  assert.match(postTemplate, /'Categories',\s*html:\s*categoriesSidebarHtml/);
});

test('single post template renders tags in the sidebar', () => {
  assert.match(postTemplate, /attribute\(entry,\s*'postTags'\)/);
  assert.match(postTemplate, /entry\.postTags\s*\?\s*entry\.postTags\.all\(\)/);
  assert.match(postTemplate, /\?tag\[\]=\{\{\s*tag\.slug\|url_encode\s*\}\}/);
  assert.match(postTemplate, /'Tags',\s*html:\s*tagsSidebarHtml/);
});

test('single post template renders design source in the sidebar', () => {
  assert.match(postTemplate, /attribute\(entry,\s*'designSource'\)/);
  assert.match(postTemplate, /entry\.designSource\s*\?\s*entry\.designSource\.all\(\)/);
  assert.match(postTemplate, /\?designSource\[\]=\{\{\s*entryDesignSource\.slug\|url_encode\s*\}\}/);
  assert.match(postTemplate, /'Design Source',\s*html:\s*designSourceSidebarHtml/);
});

test('single post template renders the year in the sidebar', () => {
  assert.match(postTemplate, /'Year',\s*text:\s*entry\.postDate\|date\('Y'\)/);
});

// ─── Archive template: every field rendered in cards or filters ───────

test('archive template renders the featured image thumbnail in cards', () => {
  assert.match(postsArchiveTemplate, /entry\.featuredImage\s*\?\s*entry\.featuredImage\.one\(\)\s*:\s*null/);
  assert.match(postsArchiveTemplate, /<img class="thumb" src="\{\{\s*image\.url\s*\}\}" alt="\{\{\s*image\.title\s*\?:\s*entry\.title\s*\}\}">/);
});

test('archive template renders the post title in card heading', () => {
  assert.match(postsArchiveTemplate, /<h3><a href="\{\{\s*entry\.url\s*\}\}">\{\{\s*entry\.title\s*\}\}<\/a><\/h3>/);
});

test('archive template renders the post date as caption', () => {
  assert.match(postsArchiveTemplate, /entry\.postDate\|date\('F Y'\)/);
});

test('archive template renders the body as an excerpt', () => {
  assert.match(postsArchiveTemplate, /entry\.body/);
  assert.match(postsArchiveTemplate, /entry\.body\|striptags\|trim/);
  assert.match(postsArchiveTemplate, /excerpt\|slice\(0,\s*145\)/);
});

test('archive template renders project types as a chip', () => {
  assert.match(postsArchiveTemplate, /attribute\(entry,\s*'projectTypes'\)/);
  assert.match(postsArchiveTemplate, /entry\.projectTypes\s*\?\s*entry\.projectTypes\.all\(\)/);
  assert.match(postsArchiveTemplate, /class="chip color-pair-\{\{\s*entryProjectTypeChip\.colourPair\s*\}\}"/);
});

test('archive template renders design source as a chip', () => {
  assert.match(postsArchiveTemplate, /attribute\(entry,\s*'designSource'\)/);
  assert.match(postsArchiveTemplate, /entry\.designSource\s*\?\s*entry\.designSource\.all\(\)/);
  assert.match(postsArchiveTemplate, /class="chip color-pair-\{\{\s*entryDesignSource\.colourPair\s*\}\}"/);
});

test('archive template renders categories as chip links', () => {
  assert.match(postsArchiveTemplate, /attribute\(entry,\s*'postCategories'\)/);
  assert.match(postsArchiveTemplate, /entry\.postCategories\s*\?\s*entry\.postCategories\.all\(\)/);
  assert.match(postsArchiveTemplate, /class="chip color-pair-\{\{\s*attribute\(category,\s*'colourPair'\)\s*\}\}"/);
  assert.match(postsArchiveTemplate, /\?category\[\]=\{\{\s*category\.slug\|url_encode\s*\}\}/);
});

test('archive template renders tags in the filter sidebar', () => {
  assert.match(postsArchiveTemplate, /attribute\(postEntry,\s*'postTags'\)/);
  assert.match(postsArchiveTemplate, /postEntry\.postTags\s*\?\s*postEntry\.postTags\.all\(\)/);
  assert.match(postsArchiveTemplate, /name="tag\[\]"/);
});

test('archive template renders year filter from postDate', () => {
  assert.match(postsArchiveTemplate, /postEntry\.postDate\s*\?\s*postEntry\.postDate\|date\('Y'\)/);
  assert.match(postsArchiveTemplate, /name="year\[\]"/);
});
