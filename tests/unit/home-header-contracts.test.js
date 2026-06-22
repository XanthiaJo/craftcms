const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('home page still consumes the editable home globals and home card fields', () => {
  const template = read('templates/index.twig');

  assert.match(template, /craft\.app\.globals\.getSetByHandle\('home'\)/);
  assert.match(template, /homeHeading\s*=\s*home and home\.homeHeading \? home\.homeHeading : ''/);
  assert.match(template, /homeIntro\s*=\s*home and home\.homeIntro \? home\.homeIntro : ''/);
  assert.match(template, /homeCards\s*=\s*home \? home\.homeCards\.all\(\) : \[]/);
  assert.match(template, /card\.getFieldValue\('homeCardImage'\)/);
  assert.match(template, /card\.getFieldValue\('homeCardText'\)/);
  assert.match(template, /card\.getFieldValue\('homeCardLink'\)/);
  assert.match(template, /<h3>\{\{\s*card\.title\s*\}\}<\/h3>/);
  assert.match(template, /<a class="button button-primary" href="\/posts">See all projects!<\/a>/);
});

test('site header still consumes the editable navigation globals', () => {
  const template = read('templates/_partials/site-header.twig');

  assert.match(template, /siteHeader\.siteName/);
  assert.match(template, /siteHeader\.siteNavigation\.all\(\)/);
  assert.match(template, /attribute\(item,\s*'siteNavLabel'\)/);
  assert.match(template, /attribute\(item,\s*'siteNavUrl'\)/);
  assert.match(template, /attribute\(item,\s*'siteNavChildren'\)/);
  assert.match(template, /submenuItem\.label\s*\?\?/);
  assert.match(template, /submenuItem\.url\s*\?\?/);
  assert.match(template, /main-nav/);
  assert.match(template, /header-project-links/);
});

test('home and header config keeps the CMS field handles stable', () => {
  assert.match(read('config/project/globalSets/home--4fb2b3ef-47c1-4d31-836a-5f8f7f0f8c2f.yaml'), /fieldUid:\s*e7c37c0b-1ba6-4e81-ab3c-5098fcf9218d\s+# Home Heading/);
  assert.match(read('config/project/globalSets/home--4fb2b3ef-47c1-4d31-836a-5f8f7f0f8c2f.yaml'), /fieldUid:\s*5b3aea98-6154-4441-b434-0ccff8aabf4c\s+# Home Intro/);
  assert.match(read('config/project/globalSets/home--4fb2b3ef-47c1-4d31-836a-5f8f7f0f8c2f.yaml'), /fieldUid:\s*e937e671-7ee5-4111-8c6f-440df087bae6\s+# Home Cards/);

  assert.match(read('config/project/globalSets/siteHeader--7c6b1435-4697-4f69-89da-0f52489f40c7.yaml'), /fieldUid:\s*6d5f633b-173a-4a21-bbee-cb8590d766f1\s+# Site Name/);
  assert.match(read('config/project/globalSets/siteHeader--7c6b1435-4697-4f69-89da-0f52489f40c7.yaml'), /fieldUid:\s*392516be-39ef-42d6-af30-f84123d033d9\s+# Site Navigation/);

  assert.match(read('config/project/fields/homeCardImage--672dca83-46cd-4ac4-aa4b-65e9d7430d7a.yaml'), /^handle:\s*homeCardImage$/m);
  assert.match(read('config/project/fields/homeCardLink--2c8cda87-8dae-4200-90ab-ee9059f6bcc2.yaml'), /^handle:\s*homeCardLink$/m);
  assert.match(read('config/project/fields/homeCardText--101aedec-3a1b-481f-b8ae-4522481936b6.yaml'), /^handle:\s*homeCardText$/m);
  assert.match(read('config/project/fields/siteNavChildren--3a06dc53-056c-4456-af7e-d0a31bfa07b5.yaml'), /^handle:\s*siteNavChildren$/m);
  assert.match(read('config/project/fields/siteNavLabel--37ace21d-9659-4ab9-9eb8-4f9baf881c29.yaml'), /^handle:\s*siteNavLabel$/m);
  assert.match(read('config/project/fields/siteNavUrl--ad486461-8a57-4496-bf13-b475d020d92f.yaml'), /^handle:\s*siteNavUrl$/m);
});

test('sidebar partial still supports both raw HTML and plain text sections', () => {
  const template = read('templates/_partials/sidebar.twig');

  assert.match(template, /section\.html is defined and section\.html/);
  assert.match(template, /section\.html\|raw/);
  assert.match(template, /section\.text/);
  assert.match(template, /panel--sticky/);
});
