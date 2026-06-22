const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..');
const postsTemplate = fs.readFileSync(path.join(rootDir, 'templates', 'posts.twig'), 'utf8');
const siteCss = fs.readFileSync(path.join(rootDir, 'web', 'css', 'site.css'), 'utf8');

test('posts archive template renders the expected card content and filters', () => {
  assert.match(postsTemplate, /featuredImage\s*\?\s*entry\.featuredImage\.one\(\)\s*:\s*null/);
  assert.match(postsTemplate, /<img class="thumb" src="\{\{\s*image\.url\s*\}\}" alt="\{\{\s*image\.title\s*\?:\s*entry\.title\s*\}\}">/);
  assert.match(postsTemplate, /<h3><a href="\{\{\s*entry\.url\s*\}\}">\{\{\s*entry\.title\s*\}\}<\/a><\/h3>/);
  assert.match(postsTemplate, /entry\.postDate\|date\('F Y'\)/);
  assert.match(postsTemplate, /name="projectType\[\]"/);
  assert.match(postsTemplate, /name="category\[\]"/);
  assert.match(postsTemplate, /name="tag\[\]"/);
  assert.match(postsTemplate, /name="year\[\]"/);
  assert.match(postsTemplate, /\?category\[\]=\{\{\s*category\.slug\|url_encode\s*\}\}/);
  assert.match(postsTemplate, /selectedProjectTypeSlugs/);
  assert.match(postsTemplate, /selectedTagSlugs/);
  assert.match(postsTemplate, /selectedYears/);
});

test('site CSS encodes the archive typography and card layout rules', () => {
  assert.match(siteCss, /--font-body:\s*"Open Sans",\s*sans-serif;/);
  assert.match(siteCss, /--font-heading:\s*"Playfair Display",\s*serif;/);
  assert.match(siteCss, /--font-brand:\s*"Dancing Script",\s*cursive;/);
  assert.match(siteCss, /\.card-heading h3\s*\{[\s\S]*-webkit-line-clamp:\s*2;/);
  assert.match(siteCss, /\.card-heading > \.subtitle\s*\{[\s\S]*-webkit-line-clamp:\s*2;/);
  assert.match(siteCss, /\.card-excerpt\s*\{[\s\S]*-webkit-line-clamp:\s*3;/);
  assert.match(siteCss, /\.card-date\s*\{[\s\S]*margin-top:\s*auto;/);
  assert.match(siteCss, /\.subtitle\s*\{[\s\S]*text-transform:\s*uppercase;/);
  assert.match(siteCss, /\.caption\s*\{[\s\S]*font-size:\s*var\(--type-caption\);/);
});

test('template and CSS still advertise the visible project archive chrome', () => {
  assert.match(postsTemplate, /<aside class="panel posts-panel">/);
  assert.match(postsTemplate, /<h3>Project Type<\/h3>/);
  assert.match(postsTemplate, /<h3>Categories<\/h3>/);
  assert.match(postsTemplate, /<h3>Tags<\/h3>/);
  assert.match(postsTemplate, /<h3>Year<\/h3>/);
  assert.match(siteCss, /\.content-with-sidebar\s*\{/);
  assert.match(siteCss, /\.grid\s*\{/);
});
