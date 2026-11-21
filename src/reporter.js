import chalk from 'chalk';
import Table from 'cli-table3';

/**
 * Calculates a letter grade based on a numeric score (0 - 100).
 */
export function getGrade(score) {
  if (score >= 95) return { grade: 'A+', color: chalk.bold.green };
  if (score >= 85) return { grade: 'A', color: chalk.bold.green };
  if (score >= 75) return { grade: 'B', color: chalk.bold.blue };
  if (score >= 65) return { grade: 'C', color: chalk.bold.yellow };
  if (score >= 50) return { grade: 'D', color: chalk.bold.magenta };
  return { grade: 'F', color: chalk.bold.red };
}

/**
 * Renders an ASCII banner and CLI header.
 */
export function printHeader() {
  console.log();
  console.log(chalk.bold.cyan(' █   █ █   █ █  ███  █   █ '));
  console.log(chalk.bold.cyan(' █   █  █ █  █ █   █ ██ ██ '));
  console.log(chalk.bold.cyan(' █   █   █   █ █   █ █ █ █ '));
  console.log(chalk.bold.cyan(' █   █  █ █  █ █   █ █   █ '));
  console.log(chalk.bold.cyan('  ███  █   █ █  ███  █   █ '));
  console.log();
  console.log(chalk.bold.white('◆ ucli') + chalk.gray(' — Fast Offline Design System Linter & UI/UX Auditor'));
  console.log(chalk.gray('  Scanning frontend design tokens, grid spacing, accessibility, typography & performance'));
  console.log(chalk.gray('  ─'.repeat(72)));
}

/**
 * Renders the summary scorecard table using cli-table3.
 */
export function printScorecard({ staticSummary, staticScore }) {
  const { grade, color } = getGrade(staticScore);

  console.log();
  console.log(chalk.bold('■ Overall UI/UX Design Health Score: ') + color(`${grade} (${staticScore}/100)`));

  const table = new Table({
    head: [
      chalk.cyan('Category'),
      chalk.red('Errors'),
      chalk.yellow('Warnings'),
      chalk.blue('Info')
    ],
    style: { head: [], border: [] }
  });

  const categories = ['Tokens', 'Spacing', 'Accessibility', 'Typography', 'Layout', 'Performance'];
  categories.forEach(cat => {
    const stats = staticSummary.byCategory[cat] || { errors: 0, warnings: 0, infos: 0 };
    table.push([
      chalk.bold(cat),
      stats.errors > 0 ? chalk.red(stats.errors) : chalk.gray('0'),
      stats.warnings > 0 ? chalk.yellow(stats.warnings) : chalk.gray('0'),
      stats.infos > 0 ? chalk.blue(stats.infos) : chalk.gray('0')
    ]);
  });

  console.log();
  console.log(table.toString());
}

/**
 * Renders individual static audit issues.
 */
export function printStaticFindings(findings) {
  console.log();
  console.log(chalk.bold('■ Static Linter Inspection Findings (') + chalk.cyan(findings.length) + chalk.bold(' issues):'));

  if (findings.length === 0) {
    console.log(chalk.green('  ✔ No static design system or accessibility issues detected!'));
    return;
  }

  // Display top 30 findings to prevent overwhelming terminal
  const toShow = findings.slice(0, 30);
  toShow.forEach(item => {
    let badge = chalk.bgBlue.white(' INFO ');
    let colorFn = chalk.blue;
    if (item.severity === 'ERROR') {
      badge = chalk.bgRed.bold.white(' ERR  ');
      colorFn = chalk.red;
    } else if (item.severity === 'WARNING') {
      badge = chalk.bgYellow.black(' WARN ');
      colorFn = chalk.yellow;
    }

    const location = chalk.gray(`${item.file}:${item.line}`);
    console.log(`  ${badge} ${colorFn(item.ruleId)} ${location}`);
    console.log(`         ${item.message}`);
    if (item.codeSnippet) {
      console.log(chalk.dim(`         › ${item.codeSnippet}`));
    }
  });

  if (findings.length > 30) {
    console.log(chalk.gray(`  ... and ${findings.length - 30} more issues.`));
  }
}


/**
 * Renders findings in GitHub Actions workflow command format for CI/CD pipelines.
 */
export function printCiReport({ findings, staticSummary, staticScore }) {
  findings.forEach(item => {
    const level = item.severity === 'ERROR' ? 'error' : (item.severity === 'WARNING' ? 'warning' : 'notice');
    console.log(`::${level} file=${item.file},line=${item.line},title=${item.ruleId}::${item.message}`);
  });

  const { grade } = getGrade(staticScore);
  console.log();
  console.log(`■ CI Design System Summary: ${grade} (${staticScore}/100) | Errors: ${staticSummary.errors}, Warnings: ${staticSummary.warnings}`);
}

/**
 * Main reporter function to render the full report in terminal, JSON, or CI format.
 */
export function printReport({ findings, staticSummary, staticScore, options = {} }) {
  if (options.ci) {
    printCiReport({ findings, staticSummary, staticScore });
    return;
  }

  if (options.json) {
    const payload = {
      timestamp: new Date().toISOString(),
      staticScore,
      staticSummary,
      findings
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  printHeader();
  printScorecard({ staticSummary, staticScore });
  printStaticFindings(findings);
  console.log(chalk.gray('  ─'.repeat(72)));
  console.log(chalk.gray(`  Audit complete. Run with --json for machine-readable output.`));
  console.log();
}
