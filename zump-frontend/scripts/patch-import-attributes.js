const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', '@base-org', 'account', 'dist', 'core', 'constants.js');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Replace experimental import attributes syntax
  content = content.replace(
    /import pkg from ['"]\.\.\/\.\.\/package\.json['"] with \{ type: 'json' \};/,
    "import pkg from '../../package.json';"
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Patched @base-org/account constants.js');
} else {
  console.log('⚠️  @base-org/account constants.js not found, skipping patch');
}

