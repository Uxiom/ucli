#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDirectory } from '../src/scanner.js';
import { initConfigFile } from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const program = new Command();

program
  .name('ucli')
  .description(chalk.bold('ucli') + ' — Fast offline design system linter and UI/UX auditor')
  .version(pkg.version, '-v, --version', 'Output the current version of ucli');

// Command: init
program
  .command('init')
  .description('Initialize a default .uclirc.json configuration file in the current directory')
  .action(() => {
    try {
      const { created, configPath } = initConfigFile(process.cwd());
      if (created) {
        console.log();
        console.log(chalk.green.bold('✔ Created configuration file: ') + chalk.cyan(path.relative(process.cwd(), configPath) || configPath));
        console.log(chalk.gray('  You can now customize your spacing grid, allowed dimensions, and rule severities.'));
        console.log();
      } else {
        console.log();
        console.log(chalk.yellow.bold('⚠ Configuration file already exists: ') + chalk.gray(path.relative(process.cwd(), configPath) || configPath));
        console.log();
      }
    } catch (err) {
      console.error(chalk.red.bold('✖ Failed to initialize configuration: ') + chalk.red(err.message));
      process.exitCode = 1;
    }
  });

// Command: scan
program
  .command('scan [directory]')
  .description('Scan a frontend directory or file for design system & accessibility violations')
  .option('-j, --json', 'Output results in JSON format', false)
  .option('-i, --ignore <patterns...>', 'Additional glob patterns to ignore', [])
  .option('-c, --config <path>', 'Path to custom ucli configuration file')
  .option('--no-open', 'Prevent the HTML dashboard from opening automatically')
  .action(async (directory = '.', options) => {
    try {
      const results = await scanDirectory(directory, {
        json: options.json,
        ignore: options.ignore || [],
        config: options.config || null,
        openBrowser: options.open
      });
      
      // CI/CD Support: Exit with code 1 if any ERROR level violations are found
      if (results.staticSummary && results.staticSummary.errors > 0) {
        process.exitCode = 1;
      }
    } catch (err) {
      if (options.json) {
        console.error(JSON.stringify({ error: err.message }, null, 2));
      } else {
        console.error();
        console.error(chalk.red.bold('✖ ucli scan failed: ') + chalk.red(err.message));
        console.error();
      }
      process.exitCode = 1;
    }
  });

// Parse commands
program.parse(process.argv);

// If no command specified, print help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
