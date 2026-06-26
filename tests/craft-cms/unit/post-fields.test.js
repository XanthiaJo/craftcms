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
  assert.match(postTemplate, /<img class="featured-image" src="\{\{\s*featuredImage\.url\s*\}\}" alt="\{\{\s*featuredImage\.title\s*\?:\s*entry\.title\s*\}\}">/);
});

test('single post template renders the post date', () => {
  assert.match(postTemplate, /entry\.postDate\|date\('F j, Y'\)/);
});

test('single post template renders the body content', () => {
  assert.match(postTemplate, /entry\.body/);
  assert.match(postTemplate, /entry\.body\|nl2br/);
});

test('single post template renders the post images gallery', () => {
  assert.match(postTemplate, /attribute\(entry,\s*'postImages'\)/);
  assert.match(postTemplate, /entry\.postImages\s*\?\s*entry\.postImages\.all\(\)/);
  assert.match(postTemplate, /class="gallery"/);
  assert.match(postTemplate, /<img class="gallery-image" src="\{\{\s*galleryImage\.url\s*\}\}" alt="\{\{\s*galleryImage\.title\s*\?:\s*entry\.title\s*\}\}">/);
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
