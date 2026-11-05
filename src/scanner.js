import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import ora from 'ora';
import chalk from 'chalk';
import { exec } from 'node:child_process';
import { lintFile, summarizeFindings } from './linter.js';
import { printReport } from './reporter.js';
import { generateHtmlReport } from './htmlReporter.js';
import { loadConfig } from './config.js';

export { lintFile };

function openFile(filePath) {
  return new Promise((resolve) => {
    let command;
    if (process.platform === 'win32') {
      command = `start "" "${filePath}"`;
    } else if (process.platform === 'darwin') {
      command = `open "${filePath}"`;
    } else {
      command = `xdg-open "${filePath}"`;
    }
    exec(command, () => resolve());
  });
}

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/.next/**',
  '**/coverage/**'
];

/**
 * Resolves local frontend files matching design/markup/style extensions.
 * @param {string} targetPath - Absolute or relative directory/file path
 * @param {Array<string>} [ignorePatterns] - Glob ignore patterns
 * @returns {Promise<Array<string>>} List of absolute file paths
 */
export async function resolveFiles(targetPath, ignorePatterns = []) {
  const absTarget = path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(absTarget)) {
    throw new Error(`Target path does not exist: ${absTarget}`);
  }

  const stat = fs.statSync(absTarget);
  if (stat.isFile()) {
    return [absTarget];
  }

  const pattern = '**/*.{html,jsx,tsx,vue,svelte,css,scss,less,js,ts,dart,xml,swift}';
  const ignore = [...DEFAULT_IGNORE, ...ignorePatterns];

  const matched = await glob(pattern, {
    cwd: absTarget,
    ignore,
    absolute: true,
    nodir: true
  });

  return matched;
}

/**
 * Main scanner function: orchestrates local file resolution, static checks, and terminal reporting.
 * @param {string} targetPath
 * @param {Object} [options]
 * @param {boolean} [options.json=false] - Set to true for JSON output
 * @param {Array<string>} [options.ignore=[]] - Additional ignore patterns
 * @param {string|null} [options.config=null] - Optional path to config file
 * @param {boolean} [options.openBrowser=true] - Set to true to open HTML dashboard
 */
export async function scanDirectory(targetPath = '.', options = {}) {
  const {
    json = false,
    ignore = [],
    config: customConfigPath = null,
    openBrowser = true
  } = options;

  let spinner = null;
  if (!json) {
    spinner = ora({
      text: chalk.cyan('Resolving target frontend source files...'),
      color: 'cyan'
    }).start();
  }

  try {
    const absTarget = path.resolve(process.cwd(), targetPath);
    const startDir = fs.existsSync(absTarget) && fs.statSync(absTarget).isDirectory()
      ? absTarget
      : path.dirname(absTarget);

    // Load configuration
    const { config: projectConfig, configPath } = loadConfig(customConfigPath, startDir);
    const mergedIgnore = [...(projectConfig.ignore || []), ...ignore];

    const files = await resolveFiles(targetPath, mergedIgnore);

    if (files.length === 0) {
      if (spinner) spinner.stop();
      if (!json) {
        console.log(chalk.yellow(`⚠ No frontend/mobile source files (.html, .jsx, .tsx, .vue, .css, .scss, .dart, .xml, .swift) found in ${targetPath}`));
      }
      return { findings: [], staticSummary: null, staticScore: 100 };
    }

    if (spinner) {
      const configMsg = configPath ? ` [config: ${path.basename(configPath)}]` : '';
      spinner.text = chalk.cyan(`Running static inspection across ${files.length} file(s)...${configMsg}`);
    }

    const allFindings = [];
    const rootDir = fs.existsSync(absTarget) && fs.statSync(absTarget).isDirectory()
      ? absTarget
      : process.cwd();

    for (const file of files) {
      const findings = lintFile(file, rootDir, projectConfig);
      allFindings.push(...findings);
    }

    const { summary, staticScore } = summarizeFindings(allFindings, files.length);

    if (spinner) spinner.stop();

    // Print formatted output (terminal or JSON)
    printReport({
      findings: allFindings,
      staticSummary: summary,
      staticScore,
      options: {
        ...options,
        configPath
      }
    });

    if (!json && openBrowser) {
      if (spinner) {
        spinner.start(chalk.cyan('Generating HTML Dashboard...'));
      }
      try {
        const reportPath = generateHtmlReport({ findings: allFindings, staticSummary: summary, staticScore });
        await openFile(reportPath);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Give OS time to launch browser
        if (spinner) {
          spinner.stopAndPersist({ symbol: chalk.green('◆'), text: chalk.green('Dashboard generated.') });
          console.log(chalk.gray(`  Report saved to: ${reportPath}`));
        }
      } catch (err) {
        if (spinner) {
          spinner.stopAndPersist({ symbol: chalk.yellow('◆'), text: chalk.yellow('Failed to open HTML dashboard: ' + err.message) });
        }
      }
    }

    return {
      findings: allFindings,
      staticSummary: summary,
      staticScore,
      configPath
    };
  } catch (err) {
    if (spinner) spinner.stop();
    throw err;
  }
}
