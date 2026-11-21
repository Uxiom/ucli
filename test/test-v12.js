import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, initConfigFile } from '../src/config.js';
import { lintFile } from '../src/linter.js';

console.log('=== RUNNING UCLI V1.2.0 VERIFICATION SUITE ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [✔] PASS: ${message}`);
    passed++;
  } else {
    console.error(`  [x] FAIL: ${message}`);
    failed++;
  }
}

// 1. Config loading with defaults
const def = loadConfig();
assert(def.config.grid === 4, 'Default grid should be 4');
assert(def.config.rules['TAILWIND-001'] === 'WARNING', 'TAILWIND-001 default severity is WARNING');
assert(def.config.rules['TAILWIND-002'] === 'ERROR', 'TAILWIND-002 default severity is ERROR');

// 2. initConfigFile in a clean temporary directory
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucli-test-'));
const initRes1 = initConfigFile(tempDir);
assert(initRes1.created === true, 'initConfigFile creates .uclirc.json in empty dir');
assert(fs.existsSync(initRes1.configPath), '.uclirc.json exists on disk');

const initRes2 = initConfigFile(tempDir);
assert(initRes2.created === false, 'initConfigFile refuses to overwrite existing .uclirc.json');

// 3. Lint bad-tailwind.jsx
const tailwindFile = path.resolve('examples/bad-tailwind.jsx');
const findings = lintFile(tailwindFile, process.cwd(), def.config);

const tw001 = findings.filter(f => f.ruleId === 'TAILWIND-001');
const tw002 = findings.filter(f => f.ruleId === 'TAILWIND-002');
const token001 = findings.filter(f => f.ruleId === 'TOKEN-001');

assert(tw001.length === 3, 'Detects exactly 3 arbitrary Tailwind spacing violations (p-[13px], mb-[7px], gap-[11px])');
assert(tw002.length === 3, 'Detects exactly 3 arbitrary Tailwind color violations (bg-[#ff5733], text-[#333333], hover:bg-[#123456])');
assert(token001.length === 0, 'Deduplication works: TOKEN-001 does not double-count Tailwind hex colors');

// 4. Comment suppression directive
const suppressedMatch = findings.find(f => f.line === 16 && f.ruleId === 'TAILWIND-001');
assert(!suppressedMatch, 'Comment directive (ucli-disable-next-line) successfully suppressed violation on line 16');

// 5. Config rule overrides
const customConfig = {
  grid: 4,
  allowedSpacingSet: new Set([0, 4, 8, 12, 16]),
  rules: {
    'TAILWIND-001': null, // turned off
    'TAILWIND-002': 'WARNING' // severity override from ERROR to WARNING
  }
};
const findingsWithCustom = lintFile(tailwindFile, process.cwd(), customConfig);
const customTw001 = findingsWithCustom.filter(f => f.ruleId === 'TAILWIND-001');
const customTw002 = findingsWithCustom.filter(f => f.ruleId === 'TAILWIND-002');
assert(customTw001.length === 0, 'Disabling TAILWIND-001 in config completely suppresses spacing findings');
assert(
  customTw002.length === 3 && customTw002.every(f => f.severity === 'WARNING'),
  'Config severity override correctly converted TAILWIND-002 to WARNING'
);

// Clean up tempDir
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(`\nResults: ${passed} Passed, ${failed} Failed.`);

if (failed > 0) {
  process.exit(1);
}
