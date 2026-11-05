import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_CONFIG = {
  grid: 4,
  allowedSpacing: [
    0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112, 128
  ],
  rules: {
    'TOKEN-001': 'error',
    'TOKEN-002': 'warning',
    'TOKEN-003': 'error',
    'TOKEN-004': 'error',
    'TOKEN-005': 'warning',
    'TOKEN-006': 'error',
    'SPACING-001': 'warning',
    'SPACING-002': 'warning',
    'SPACING-003': 'warning',
    'SPACING-004': 'warning',
    'A11Y-001': 'error',
    'A11Y-002': 'error',
    'A11Y-003': 'warning',
    'A11Y-004': 'warning',
    'A11Y-005': 'error',
    'A11Y-006': 'info',
    'TYPO-001': 'warning',
    'LAYOUT-001': 'info',
    'LAYOUT-002': 'info',
    'LAYOUT-003': 'info',
    'PERF-001': 'warning',
    'PERF-002': 'error',
    'PERF-003': 'warning',
    'PERF-004': 'info',
    'TAILWIND-001': 'warning',
    'TAILWIND-002': 'error'
  },
  ignore: []
};

const CONFIG_FILENAMES = ['ucli.config.json', '.uclirc.json', '.uclirc'];

/**
 * Normalizes rule severity from user string/number/boolean to 'ERROR' | 'WARNING' | 'INFO' | null.
 */
export function normalizeSeverity(val) {
  if (val === false || val === 'off' || val === 0 || val === 'none') {
    return null; // disabled
  }
  if (val === 'warn' || val === 'warning' || val === 1) {
    return 'WARNING';
  }
  if (val === 'info' || val === 3) {
    return 'INFO';
  }
  if (val === true || val === 'error' || val === 'err' || val === 2) {
    return 'ERROR';
  }
  return 'WARNING';
}

/**
 * Traverses upwards to locate a ucli config file.
 */
function findConfigFile(startDir) {
  let curr = path.resolve(startDir);
  const root = path.parse(curr).root;

  while (curr) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = path.join(curr, name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    if (curr === root) break;
    curr = path.dirname(curr);
  }

  return null;
}

/**
 * Loads and resolves project configuration.
 * @param {string|null} customPath - Optional path to config file
 * @param {string} startDir - Directory to start discovery from
 * @returns {{ config: Object, configPath: string|null }}
 */
export function loadConfig(customPath = null, startDir = process.cwd()) {
  let configPath = null;

  if (customPath) {
    const resolved = path.resolve(process.cwd(), customPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Specified config file not found: ${resolved}`);
    }
    configPath = resolved;
  } else {
    configPath = findConfigFile(startDir);
  }

  let userJson = {};
  if (configPath) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      userJson = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse config file at ${configPath}: ${err.message}`);
    }
  }

  const grid = typeof userJson.grid === 'number' && userJson.grid > 0 ? userJson.grid : DEFAULT_CONFIG.grid;
  const allowedSpacingArr = Array.isArray(userJson.allowedSpacing)
    ? userJson.allowedSpacing
    : DEFAULT_CONFIG.allowedSpacing;
  const allowedSpacingSet = new Set(allowedSpacingArr.map(n => Number(n)));

  // Merge rules
  const mergedRules = { ...DEFAULT_CONFIG.rules };
  if (userJson.rules && typeof userJson.rules === 'object') {
    for (const [ruleId, val] of Object.entries(userJson.rules)) {
      mergedRules[ruleId] = normalizeSeverity(val);
    }
  } else {
    // Normalize defaults
    for (const [ruleId, val] of Object.entries(mergedRules)) {
      mergedRules[ruleId] = normalizeSeverity(val);
    }
  }

  const ignore = Array.isArray(userJson.ignore) ? userJson.ignore : [];

  return {
    config: {
      grid,
      allowedSpacing: allowedSpacingArr,
      allowedSpacingSet,
      rules: mergedRules,
      ignore
    },
    configPath
  };
}

/**
 * Creates a default .uclirc.json template in the target directory.
 * @param {string} targetDir
 * @returns {{ created: boolean, configPath: string }}
 */
export function initConfigFile(targetDir = process.cwd()) {
  const filePath = path.join(path.resolve(targetDir), '.uclirc.json');

  if (fs.existsSync(filePath)) {
    return { created: false, configPath: filePath };
  }

  const template = {
    "$schema": "https://raw.githubusercontent.com/uxiom/ucli/main/schema/ucli.schema.json",
    "grid": 4,
    "allowedSpacing": [
      0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112, 128
    ],
    "rules": {
      "TOKEN-001": "error",
      "SPACING-001": "warning",
      "A11Y-001": "error",
      "A11Y-002": "error",
      "PERF-001": "warning",
      "PERF-002": "error",
      "TAILWIND-001": "warning",
      "TAILWIND-002": "error"
    },
    "ignore": [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**"
    ]
  };

  fs.writeFileSync(filePath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
  return { created: true, configPath: filePath };
}
