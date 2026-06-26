const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..', '..', '..');
const cssPath = path.join(rootDir, 'web', 'css', 'site.css');

const typicalElements = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'li',
  'a', 'strong', 'em',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'figure', 'figcaption'
];

const typicalElementPattern = typicalElements.join('|');

// Matches a class-qualified typical element, e.g. `.panel h3`, `.body > p`, `.card h3, .card h4`
// Allows `.class` on its own and `element` on its own, but not `.class element`.
const overSpecificSelectorRegex = new RegExp(
  '\\.[a-zA-Z0-9_-]+(?:\\[[^\\]]*\\])?(?:\\s*([>+~])\\s*|\\s+)(' + typicalElementPattern + ')(?![a-zA-Z0-9_-])',
  'g'
);

// Deliberate exceptions: class-qualified selectors for typical elements that are
// intentionally scoped because the element needs different styling in that context.
const whitelist = new Set([
  '.page-subheader-inner h1',
]);

function readCss() {
  return fs.readFileSync(cssPath, 'utf8');
}

function extractSelectors(css) {
  // Remove CSS comments
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const selectors = [];
  // Match each rule block: selector(s) { ... }
  const ruleRegex = /([^{}]+)\{[^{}]*\}/g;
  let match;
  while ((match = ruleRegex.exec(withoutComments)) !== null) {
    const selectorGroup = match[1].trim();
    if (!selectorGroup) continue;

    // Split combined selectors (e.g. `.a, .b`)
    for (const selector of selectorGroup.split(',')) {
      selectors.push(selector.trim());
    }
  }
  return selectors;
}

function findOverSpecificSelectors(selectors) {
  const violations = new Set();

  for (const selector of selectors) {
    overSpecificSelectorRegex.lastIndex = 0;
    if (overSpecificSelectorRegex.test(selector) && !whitelist.has(selector)) {
      violations.add(selector);
    }
  }

  return Array.from(violations).sort();
}

test('site.css lists class-qualified selectors for typical elements so they can be reviewed', () => {
  const css = readCss();
  const selectors = extractSelectors(css);
  const violations = findOverSpecificSelectors(selectors);

  // Any selector not in the whitelist is reported as a violation.
  assert.deepStrictEqual(
    violations,
    [],
    `Found class-qualified selectors for typical elements. Review these and decide whether to replace with generic element selectors or shared classes:\n${violations.join('\n')}`
  );
});
