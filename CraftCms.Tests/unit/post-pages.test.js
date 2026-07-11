const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const test = require('node:test');

const BASE = 'https://craftcms.ddev.site';

/**
 * Get all live post slugs from the Craft DB via DDEV.
 * Returns [{ id, slug, title }]
 */
function runSql(sql) {
  return execSync(`ddev exec mysql -u root -proot db -N -B -e "${sql}"`, { encoding: 'utf8' }).trim();
}

function getPostSlugs() {
  const sql = 'SELECT es.elementId, es.slug, es.title FROM elements_sites es JOIN elements e ON es.elementId = e.id JOIN entries ent ON ent.id = e.id WHERE ent.sectionId = 1 AND e.dateDeleted IS NULL AND e.revisionId IS NULL AND e.draftId IS NULL AND es.enabled = 1 ORDER BY es.slug';
  const out = runSql(sql);
  return out.trim().split('\n').filter(Boolean).map((line) => {
    const [id, slug, ...titleParts] = line.split('\t');
    return { id: parseInt(id, 10), slug, title: titleParts.join('\t') };
  });
}

/**
 * Check if a URL returns 200.
 */
function checkUrl(url) {
  try {
    const code = execSync(`ddev exec curl -s -o /dev/null -w "%{http_code}" "${url}"`, { encoding: 'utf8' }).trim();
    return parseInt(code, 10);
  } catch {
    return 0;
  }
}

// ─── All post pages should return 200 ─────────────────────────────────

test('all post pages return 200 (no 404s)', () => {
  const posts = getPostSlugs();
  assert.ok(posts.length > 0, 'should have at least one post');

  const broken = [];
  for (const post of posts) {
    const code = checkUrl(`${BASE}/posts/${post.slug}`);
    if (code !== 200) {
      broken.push({ slug: post.slug, title: post.title, status: code });
    }
  }

  assert.equal(broken.length, 0,
    `Posts returning non-200 status:\n${broken.map((b) => `  ${b.slug} (${b.title}): ${b.status}`).join('\n')}`);
});

// ─── No duplicate slugs in the database ───────────────────────────────

test('no duplicate slugs in elements_sites for post entries', () => {
  const sql = 'SELECT es.slug, COUNT(*) as cnt FROM elements_sites es JOIN elements e ON es.elementId = e.id JOIN entries ent ON ent.id = e.id WHERE ent.sectionId = 1 AND e.dateDeleted IS NULL AND e.revisionId IS NULL AND e.draftId IS NULL GROUP BY es.slug HAVING cnt > 1';
  const out = runSql(sql);

  assert.equal(out, '', `Duplicate slugs found:\n${out}`);
});

// ─── No orphaned elements_sites rows (element soft-deleted) ───────────

test('no elements_sites rows for soft-deleted post entries', () => {
  const sql = 'SELECT es.elementId, es.slug FROM elements_sites es JOIN elements e ON es.elementId = e.id JOIN entries ent ON ent.id = e.id WHERE ent.sectionId = 1 AND e.dateDeleted IS NOT NULL AND e.revisionId IS NULL AND e.draftId IS NULL';
  const out = runSql(sql);

  assert.equal(out, '', `Orphaned elements_sites rows for deleted entries:\n${out}`);
});

// ─── All post entries must have content (not NULL) ────────────────────

test('all post entries have non-NULL content in elements_sites', () => {
  const sql = "SELECT es.elementId, es.slug FROM elements_sites es JOIN elements e ON es.elementId = e.id JOIN entries ent ON ent.id = e.id WHERE ent.sectionId = 1 AND e.dateDeleted IS NULL AND e.revisionId IS NULL AND e.draftId IS NULL AND es.content IS NULL";
  const out = runSql(sql);

  assert.equal(out, '', `Entries with NULL content:\n${out}`);
});

// ─── All post entries must have body text ─────────────────────────────

test('all post entries have body text in content JSON', () => {
  // The body field layout element UID is e25caf86-a917-4d74-bd83-09fd75ea4ba0
  // Check the key exists in the content JSON (NULL content is caught by the previous test)
  const uid = 'e25caf86-a917-4d74-bd83-09fd75ea4ba0';
  const sql = `SELECT es.elementId, es.slug FROM elements_sites es JOIN elements e ON es.elementId = e.id JOIN entries ent ON ent.id = e.id WHERE ent.sectionId = 1 AND e.dateDeleted IS NULL AND e.revisionId IS NULL AND e.draftId IS NULL AND es.content NOT LIKE '%${uid}%'`;
  const out = runSql(sql);

  assert.equal(out, '', `Entries with missing body field in content JSON:\n${out}`);
});

// ─── All post entries must have resourceLinks field ──────────────────

test('all post entries have resourceLinks field in content JSON', () => {
  // The resourceLinks field layout element UID is 2fd8e9bb-727c-4a34-ae0b-d1cda3812cb6
  const uid = '2fd8e9bb-727c-4a34-ae0b-d1cda3812cb6';
  const sql = `SELECT es.elementId, es.slug FROM elements_sites es JOIN elements e ON es.elementId = e.id JOIN entries ent ON ent.id = e.id WHERE ent.sectionId = 1 AND e.dateDeleted IS NULL AND e.revisionId IS NULL AND e.draftId IS NULL AND es.content NOT LIKE '%${uid}%'`;
  const out = runSql(sql);

  assert.equal(out, '', `Entries with missing resourceLinks field in content JSON:\n${out}`);
});
