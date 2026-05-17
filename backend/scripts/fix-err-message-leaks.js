// One-time security fix script.
// Replaces `res.status(500).json({ error: err.message })` patterns with a generic message,
// and ensures the full error is still logged server-side.

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const DIRS = ['routes', 'middleware', 'services'];

function walk(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...walk(full));
    else if (item.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const PATTERN = /^(\s*)res\.status\(500\)\.json\(\s*\{\s*error:\s*err\.message\s*\}\s*\);?\s*$/gm;

let totalChanges = 0;

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const before = fs.readFileSync(file, 'utf8');
    const matches = before.match(PATTERN);
    if (!matches) continue;

    const after = before.replace(PATTERN, (_, indent) =>
      `${indent}console.error(err);\n${indent}res.status(500).json({ error: 'Internal server error' });`
    );

    console.log(`  ${path.relative('.', file)}: ${matches.length} change(s)`);
    totalChanges += matches.length;

    if (!DRY_RUN) fs.writeFileSync(file, after, 'utf8');
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] Would make' : 'Made'} ${totalChanges} replacement(s).`);
if (DRY_RUN) console.log(`Re-run without --dry-run to apply.`);