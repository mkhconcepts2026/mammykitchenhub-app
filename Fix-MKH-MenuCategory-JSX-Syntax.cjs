const fs = require('node:fs');
const path = require('node:path');

const projectRoot = process.argv[2] || process.cwd();
const relativeFile = path.join('app', 'dashboard', 'page.tsx');
const filePath = path.join(projectRoot, relativeFile);

if (!fs.existsSync(filePath)) {
  console.error(`Required file not found: ${filePath}`);
  process.exit(1);
}

const original = fs.readFileSync(filePath, 'utf8');
const content = original.replace(/\r\n/g, '\n');
const startMarker =
  '            {selectedCategory ? (\n' +
  '              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">\n' +
  '                {filteredMenuItems.map((item) => {';
const endMarker = '\n            )}\n          )}';

const startCount = content.split(startMarker).length - 1;
if (startCount !== 1) {
  console.error(`Safety check failed: expected exactly one malformed category block, found ${startCount}. No files changed.`);
  process.exit(1);
}

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
if (endIndex === -1) {
  console.error('Safety check failed: could not find the expected end of the category block. No files changed.');
  process.exit(1);
}
const correctedStart = startMarker.replace('            {selectedCategory ? (', '            selectedCategory ? (');
let corrected = content.slice(0, startIndex) + correctedStart + content.slice(startIndex + startMarker.length);
const adjustedEndIndex = corrected.indexOf(endMarker, startIndex + correctedStart.length);
if (adjustedEndIndex === -1) {
  console.error('Safety check failed: closing marker changed unexpectedly. No files changed.');
  process.exit(1);
}
const correctedEnd = '\n            )\n          )}';
corrected = corrected.slice(0, adjustedEndIndex) + correctedEnd + corrected.slice(adjustedEndIndex + endMarker.length);

if (corrected === content) {
  console.error('Safety check failed: correction produced no change. No files changed.');
  process.exit(1);
}

const backupRoot = path.join(path.dirname(projectRoot), 'backups');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(backupRoot, `mkh-menu-jsx-fix-${stamp}`);
try {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(filePath, path.join(backupDir, 'page.tsx'));
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(filePath, corrected.replace(/\n/g, eol), 'utf8');
  console.log('Fixed the malformed nested category-rendering expression locally.');
  console.log(`Changed: ${relativeFile}`);
  console.log(`Backup: ${backupDir}`);
  console.log('No database changes, Git operations, or deployment were performed.');
} catch (error) {
  console.error(`Could not complete the local fix: ${error.message}`);
  process.exit(1);
}
