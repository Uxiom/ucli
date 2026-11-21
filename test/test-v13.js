import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { lintFile, fixFile } from '../src/linter.js';
import { generateBadgeSvg } from '../src/badge.js';
import { printCiReport } from '../src/reporter.js';

console.log('=== RUNNING UCLI V1.3.0 VERIFICATION SUITE ===\n');

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

// 1. Media query breakpoint intelligence
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucli-v13-test-'));
const testCssPath = path.join(tempDir, 'responsive.css');

fs.writeFileSync(testCssPath, `
@media (max-width: 899px) {
  .card {
    padding: 16px;
  }
}

@container (min-width: 767px) {
  .sidebar {
    gap: 8px;
  }
}

.bad-component {
  width: 899px;
  margin: 13px;
}
`, 'utf-8');

const findings = lintFile(testCssPath, tempDir);
const spacingFindings = findings.filter(f => f.ruleId === 'SPACING-001');

assert(spacingFindings.length === 2, 'Catches exactly 2 violations for width: 899px and margin: 13px');
assert(!spacingFindings.some(f => f.line === 2), 'Exempts @media (max-width: 899px) from SPACING-001');
assert(!spacingFindings.some(f => f.line === 8), 'Exempts @container (min-width: 767px) from SPACING-001');

// 2. Auto-fix / Grid Snapping for CSS and Tailwind
const testFixPath = path.join(tempDir, 'fix-target.jsx');
fs.writeFileSync(testFixPath, `
export default function Card() {
  return (
    <div className="p-[13px] gap-[15px] m-[7px]">
      <style>{\`
        .inner {
          margin: 19px 7px;
          padding: 13px;
          width: 899px;
        }
      \`}</style>
    </div>
  );
}
`, 'utf-8');

const fixResult = fixFile(testFixPath, { grid: 4 });
assert(fixResult.modified === true, 'fixFile reports modified: true');
assert(fixResult.fixedCount > 0, `fixFile snapped ${fixResult.fixedCount} values`);

const fixedContent = fs.readFileSync(testFixPath, 'utf-8');
assert(fixedContent.includes('p-[12px]'), 'Snaps Tailwind p-[13px] -> p-[12px]');
assert(fixedContent.includes('gap-[16px]'), 'Snaps Tailwind gap-[15px] -> gap-[16px]');
assert(fixedContent.includes('m-[8px]'), 'Snaps Tailwind m-[7px] -> m-[8px]');
assert(fixedContent.includes('margin: 20px 8px;'), 'Snaps CSS margin: 19px 7px -> margin: 20px 8px');
assert(fixedContent.includes('padding: 12px;'), 'Snaps CSS padding: 13px -> padding: 12px');
assert(fixedContent.includes('width: 900px;'), 'Snaps CSS width: 899px -> width: 900px');

// 3. SVG UI Health Score Badge
const svg100 = generateBadgeSvg(100, 'A+');
assert(svg100.includes('<svg') && svg100.includes('</svg>'), 'Badge generates valid SVG root tag');
assert(svg100.includes('A+ 100/100'), 'Badge displays A+ 100/100');
assert(svg100.includes('#22c55e'), 'Score 100 uses green accent');

const svg60 = generateBadgeSvg(60, 'D');
assert(svg60.includes('D 60/100'), 'Badge displays D 60/100');
assert(svg60.includes('#f97316'), 'Score 60 uses orange accent');

// 4. GitHub Actions CI Output format
let loggedLines = [];
const originalLog = console.log;
console.log = (msg = '') => loggedLines.push(msg);

try {
  printCiReport({
    findings: [
      { ruleId: 'SPACING-001', file: 'src/app.css', line: 42, severity: 'WARNING', message: 'Spacing violation' },
      { ruleId: 'CONTRAST-001', file: 'src/card.jsx', line: 12, severity: 'ERROR', message: 'Low contrast' }
    ],
    staticSummary: { errors: 1, warnings: 1, notices: 0 },
    staticScore: 88
  });
} finally {
  console.log = originalLog;
}

assert(loggedLines.some(l => l.startsWith('::warning file=src/app.css,line=42,title=SPACING-001::')), 'Generates ::warning workflow annotation');
assert(loggedLines.some(l => l.startsWith('::error file=src/card.jsx,line=12,title=CONTRAST-001::')), 'Generates ::error workflow annotation');
assert(loggedLines.some(l => l.includes('CI Design System Summary')), 'Outputs CI summary line');

// Clean up
try {
  fs.rmSync(tempDir, { recursive: true, force: true });
} catch {
  // ignore
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exitCode = 1;
}
