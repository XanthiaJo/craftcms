const fs = require('node:fs');
const path = require('node:path');

const unitDir = __dirname;

for (const fileName of fs.readdirSync(unitDir)) {
  if (fileName === 'all.test.js' || !fileName.endsWith('.test.js')) {
    continue;
  }

  require(path.join(unitDir, fileName));
}
