#!/usr/bin/env node
// Fails on violations of the repo's BESPOKE invariants only.
//
// eslint.config.mjs encodes two rules that are not style preferences — they are
// the guards behind one-owner invariants, each written after the drift it
// prevents reached production:
//   • no hand-built `/product/...` URLs (canonical URLs have one owner,
//     lib/urls.ts; Google once indexed /product/<ObjectId> beside the slug URL)
//   • no hex or colour keywords under app/admin (the admin palette is a closed
//     token set; it had grown 190 literals — 10 reds, 11 greens, 5 ambers)
//
// Why this exists separately from `npm run lint`: that command currently reports
// 113 errors, almost all react-hooks/set-state-in-effect across admin pages that
// predate this script, plus unescaped entities and html links. None of them are
// enforced anywhere — Next 16 does not run eslint during `next build` — so the
// whole lot has been advisory for a long time. Blocking CI on all 113 would mean
// a refactor nobody asked for; letting CI ignore lint entirely would leave the
// two invariants unguarded, which is how they got broken the first time.
//
// So: these two are blocking, everything else stays reported-but-not-blocking
// until someone decides to clear it. When the backlog is cleared, delete this
// script and make `npm run lint` blocking instead.

import { ESLint } from 'eslint';

// The rule that carries both invariants. Restated here rather than inferred,
// because the failure mode this guards against is a config edit that silently
// switches the rule off — ESLint flat config REPLACES a rule's options rather
// than merging them, so one block declaring one selector disables the others.
const BLOCKING_RULES = new Set(['no-restricted-syntax']);

const eslint = new ESLint({ cwd: process.cwd() });
const results = await eslint.lintFiles(['app', 'components', 'lib', 'context']);

const violations = results.flatMap(r =>
  r.messages
    .filter(m => BLOCKING_RULES.has(m.ruleId))
    .map(m => ({ file: r.filePath.replace(`${process.cwd()}/`, ''), line: m.line, message: m.message })),
);

if (violations.length === 0) {
  console.log(`✓ invariants hold (${BLOCKING_RULES.size} blocking rule checked over ${results.length} files)`);
  process.exit(0);
}

console.error(`\n✗ ${violations.length} invariant violation${violations.length > 1 ? 's' : ''}:\n`);
for (const v of violations) console.error(`  ${v.file}:${v.line}\n    ${v.message}\n`);
console.error('These are one-owner invariants, not style. See eslint.config.mjs and PROJECT_MAP.md.');
process.exit(1);
