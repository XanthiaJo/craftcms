const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('category archive still renders the editable post card fields', () => {
  const template = read('templates/category.twig');

  assert.match(template, /entry\.featuredImage\s*\?\s*entry\.featuredImage\.one\(\)\s*:\s*null/);
  assert.match(template, /<img class="thumb" src="\{\{\s*image\.url\s*\}\}" alt="\{\{\s*image\.title\s*\?:\s*entry\.title\s*\}\}">/);
  assert.match(template, /<h3><a href="\{\{\s*entry\.url\s*\}\}">\{\{\s*entry\.title\s*\}\}<\/a><\/h3>/);
  assert.match(template, /entry\.body\|striptags\|trim\|slice\(0,\s*145\)\s*~\s*'\.\.\.'/);
  assert.match(template, /aria-label="\{\{\s*category\.title\s*\}\} posts"/);
});

test('tag archive still renders the editable post card fields', () => {
  const template = read('templates/tag.twig');

  assert.match(template, /entry\.featuredImage\s*\?\s*entry\.featuredImage\.one\(\)\s*:\s*null/);
  assert.match(template, /<img class="thumb" src="\{\{\s*image\.url\s*\}\}" alt="\{\{\s*image\.title\s*\?:\s*entry\.title\s*\}\}">/);
  assert.match(template, /<h3><a href="\{\{\s*entry\.url\s*\}\}">\{\{\s*entry\.title\s*\}\}<\/a><\/h3>/);
  assert.match(template, /entry\.body\|striptags\|trim\|slice\(0,\s*145\)\s*~\s*'\.\.\.'/);
  assert.match(template, /aria-label="\{\{\s*tag\.title\s*\}\} posts"/);
});

test('single post template still exposes the full editable content model', () => {
  const template = read('templates/_entries/post.twig');

  assert.match(template, /entry\.featuredImage\s*\?\s*entry\.featuredImage\.one\(\)\s*:\s*null/);
  assert.match(template, /entry\.postDate\|date\('F j, Y'\)/);
  assert.match(template, /entry\.body\|nl2br/);
  assert.match(template, /attribute\(entry,\s*'postImages'\)/);
  assert.match(template, /attribute\(entry,\s*'resourceLinks'\)/);
  assert.match(template, /attribute\(entry,\s*'projectTypes'\)/);
  assert.match(template, /attribute\(entry,\s*'postCategories'\)/);
  assert.match(template, /attribute\(entry,\s*'postTags'\)/);
  assert.match(template, /attribute\(entry,\s*'designSource'\)/);
  assert.match(template, /postsIndexUrl \}\}\?category\[\]=\{\{\s*category\.slug\|url_encode\s*\}\}/);
  assert.match(template, /postsIndexUrl \}\}\?projectType\[\]=\{\{\s*projectType\.slug\|url_encode\s*\}\}/);
  assert.match(template, /postsIndexUrl \}\}\?tag\[\]=\{\{\s*tag\.slug\|url_encode\s*\}\}/);
  assert.match(template, /postsIndexUrl \}\}\?designSource\[\]=\{\{\s*entryDesignSource\.slug\|url_encode\s*\}\}/);
});
