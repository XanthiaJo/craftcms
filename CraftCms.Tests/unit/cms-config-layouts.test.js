const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function expectFileHasHandle(relativePath, expectedHandle) {
  const contents = read(relativePath);
  assert.match(contents, new RegExp(`^handle:\\s*${expectedHandle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
}

function expectFileHasLabel(relativePath, expectedLabel) {
  const contents = read(relativePath);
  assert.match(contents, new RegExp(`#\\s*${expectedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
}

test('post editor layout keeps the card-editable fields in Craft admin', () => {
  const postLayout = read('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml');
  const chipField = read('config/project/fields/colourPair--3cb6b6d4-4bf5-4f4a-a9dc-0ef1fdbe6f2a.yaml');

  assert.match(postLayout, /type:\s*craft\\fieldlayoutelements\\entries\\EntryTitleField/);
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Featured Image');
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Body');
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Instructions');
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Resource Links');
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Post Images');
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Project Types');
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Post Categories');
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Post Tags');
  expectFileHasLabel('config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml', 'Design Source');

  expectFileHasHandle('config/project/fields/featuredImage--29579835-63db-4481-b347-52f1852e0eb9.yaml', 'featuredImage');
  expectFileHasHandle('config/project/fields/body--af6550e1-b206-4dcc-a2ff-a847082b77bc.yaml', 'body');
  expectFileHasHandle('config/project/fields/instructions--53cdc25e-21c1-4998-a258-79e3ec30f36c.yaml', 'instructions');
  expectFileHasHandle('config/project/fields/resourceLinks--76c53e19-a060-468b-9dcb-6f2874cdcde4.yaml', 'resourceLinks');
  expectFileHasHandle('config/project/fields/postImages--895989d9-cefc-4582-bbad-6736c0c471b8.yaml', 'postImages');
  expectFileHasHandle('config/project/fields/projectTypes--c8ae7352-3ab5-47e7-b586-a001fbe07430.yaml', 'projectTypes');
  expectFileHasHandle('config/project/fields/postCategories--52d25c97-f091-4cfb-84f6-e2529d60f743.yaml', 'postCategories');
  expectFileHasHandle('config/project/fields/postTags--5cfa4a6e-5fa2-43f3-a646-d35ea81d5d63.yaml', 'postTags');
  expectFileHasHandle('config/project/fields/designSource--dd7373ee-b1ce-4c8d-815d-03cfaed9bd88.yaml', 'designSource');
  expectFileHasHandle('config/project/fields/colourPair--3cb6b6d4-4bf5-4f4a-a9dc-0ef1fdbe6f2a.yaml', 'colourPair');
  assert.match(chipField, /label:\s*['"]?Muted Gold['"]?/);
  assert.match(chipField, /value:\s*gold/);
  assert.match(chipField, /label:\s*['"]?Muted Sand['"]?/);
  assert.match(chipField, /value:\s*sand/);
  assert.match(chipField, /label:\s*['"]?Muted Ink['"]?/);
  assert.match(chipField, /value:\s*ink/);
  assert.match(chipField, /label:\s*['"]?Muted Moss['"]?/);
  assert.match(chipField, /value:\s*moss/);
  assert.match(chipField, /label:\s*['"]?Muted Lavender['"]?/);
  assert.match(chipField, /value:\s*lavender/);
  assert.match(chipField, /label:\s*['"]?Muted Peach['"]?/);
  assert.match(chipField, /value:\s*peach/);
  assert.match(chipField, /label:\s*['"]?Muted Slate['"]?/);
  assert.match(chipField, /value:\s*slate/);
  assert.match(chipField, /label:\s*['"]?Muted Rust['"]?/);
  assert.match(chipField, /value:\s*rust/);
  assert.match(chipField, /label:\s*['"]?Muted Berry['"]?/);
  assert.match(chipField, /value:\s*berry/);
  assert.match(chipField, /instructions:\s*'Choose a reusable muted colour pair for this term\.'/);
  assert.doesNotMatch(chipField, /value:\s*muted-/);
  assert.match(
    read('config/project/categoryGroups/postCategories--da5d8ca2-8f7f-4375-96fb-53ffeed1a4a2.yaml'),
    /fieldUid:\s*3cb6b6d4-4bf5-4f4a-a9dc-0ef1fdbe6f2a/
  );
  assert.match(
    read('config/project/categoryGroups/postCategories--da5d8ca2-8f7f-4375-96fb-53ffeed1a4a2.yaml'),
    /label:\s*'Colour Pair'/
  );
  assert.match(
    read('config/project/categoryGroups/projectTypes--1814cb28-7cb6-4a76-a95b-6b0829126ccc.yaml'),
    /fieldUid:\s*3cb6b6d4-4bf5-4f4a-a9dc-0ef1fdbe6f2a/
  );
  assert.match(
    read('config/project/categoryGroups/designSources--fc08b7eb-9365-4b5b-98fd-193abc9cc1bb.yaml'),
    /fieldUid:\s*3cb6b6d4-4bf5-4f4a-a9dc-0ef1fdbe6f2a/
  );
});

test('projects archive single keeps the editable sidebar copy fields', () => {
  const archiveLayout = read('config/project/entryTypes/projectsArchive--fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c.yaml');

  expectFileHasLabel('config/project/entryTypes/projectsArchive--fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c.yaml', 'Projects Archive Heading');
  expectFileHasLabel('config/project/entryTypes/projectsArchive--fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c.yaml', 'Projects Archive Meta Description');
  expectFileHasLabel('config/project/entryTypes/projectsArchive--fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c.yaml', 'Projects Archive Sidebar Intro');
  assert.match(archiveLayout, /hasTitleField:\s*false/);

  expectFileHasHandle('config/project/fields/projectsArchiveHeading--79c2cc19-c161-4916-b859-98f211c101b5.yaml', 'projectsArchiveHeading');
  expectFileHasHandle('config/project/fields/projectsArchiveMetaDescription--b38efefa-beb0-4839-9347-42377ec6746d.yaml', 'projectsArchiveMetaDescription');
  expectFileHasHandle('config/project/fields/projectsArchiveSidebarIntro--7a2cc7d6-44ed-42f9-ba98-82d4a58c0590.yaml', 'projectsArchiveSidebarIntro');
});

test('home and header globals keep their editable content blocks', () => {
  expectFileHasLabel('config/project/globalSets/home--4fb2b3ef-47c1-4d31-836a-5f8f7f0f8c2f.yaml', 'Home Heading');
  expectFileHasLabel('config/project/globalSets/home--4fb2b3ef-47c1-4d31-836a-5f8f7f0f8c2f.yaml', 'Home Intro');
  expectFileHasLabel('config/project/globalSets/home--4fb2b3ef-47c1-4d31-836a-5f8f7f0f8c2f.yaml', 'Home Cards');

  expectFileHasHandle('config/project/fields/homeHeading--e7c37c0b-1ba6-4e81-ab3c-5098fcf9218d.yaml', 'homeHeading');
  expectFileHasHandle('config/project/fields/homeIntro--5b3aea98-6154-4441-b434-0ccff8aabf4c.yaml', 'homeIntro');
  expectFileHasHandle('config/project/fields/homeCards--e937e671-7ee5-4111-8c6f-440df087bae6.yaml', 'homeCards');

  expectFileHasLabel('config/project/globalSets/siteHeader--7c6b1435-4697-4f69-89da-0f52489f40c7.yaml', 'Site Name');
  expectFileHasLabel('config/project/globalSets/siteHeader--7c6b1435-4697-4f69-89da-0f52489f40c7.yaml', 'Site Navigation');

  expectFileHasHandle('config/project/fields/siteName--6d5f633b-173a-4a21-bbee-cb8590d766f1.yaml', 'siteName');
  expectFileHasHandle('config/project/fields/siteNavigation--392516be-39ef-42d6-af30-f84123d033d9.yaml', 'siteNavigation');
});
