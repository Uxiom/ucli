import fs from 'node:fs';
import path from 'node:path';

// Standard 4px/8px spacing grid values in pixels up to 128px
const STANDARD_SPACING_PX = new Set([
  0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112, 128
]);

/**
 * Runs static design system & accessibility checks on a single file.
 * @param {string} filePath - Absolute or relative path to the file
 * @param {string} rootDir - Root scanning directory for relative path calculation
 * @param {Object} [userConfig={}] - Configuration options loaded from project or CLI
 * @returns {Array<Object>} List of audit findings
 */
export function lintFile(filePath, rootDir = process.cwd(), userConfig = {}) {
  const relPath = path.relative(rootDir, filePath) || path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const findings = [];

  const isMarkup = ext === '.html' || ext === '.jsx' || ext === '.tsx' || ext === '.vue' || ext === '.svelte';
  const isFlutter = ext === '.dart';
  const isAndroidXml = ext === '.xml';
  const isSwift = ext === '.swift';
  const mayHaveTailwind = isMarkup || ext === '.css' || ext === '.scss' || ext === '.js' || ext === '.ts';

  // Config setup
  const grid = typeof userConfig.grid === 'number' && userConfig.grid > 0 ? userConfig.grid : 4;
  const allowedSpacing = userConfig.allowedSpacingSet || STANDARD_SPACING_PX;
  const configuredRules = userConfig.rules || {};

  function isInvalidSpacing(num) {
    if (num <= 0) return false;
    if (allowedSpacing.has(num)) return false;
    return num % grid !== 0;
  }

  // State tracking across lines
  let lastHeadingLevel = 0;
  let currentNestingDepth = 0;
  let maxNestingDepth = 0;
  let nextLineDisabledRules = null;

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Check disable directives for current line (carried over from previous line)
    const lineDisabledRules = new Set(nextLineDisabledRules || []);
    nextLineDisabledRules = null; // reset

    // Check for inline disable directive on the CURRENT line
    // e.g. // ucli-disable-line [RULE-001, ...] or /* ucli-disable-line */ or <!-- ucli-disable-line -->
    const disableLineMatch = line.match(/(?:\/\/|\/\*|<!--)\s*ucli-disable-line(?:\s+([A-Za-z0-9_-]+(?:[,\s]+[A-Za-z0-9_-]+)*))?/i);
    if (disableLineMatch) {
      if (!disableLineMatch[1] || disableLineMatch[1].trim() === '') {
        lineDisabledRules.add('*');
      } else {
        disableLineMatch[1].split(/[,\s]+/).forEach(r => {
          if (r.trim()) lineDisabledRules.add(r.trim().toUpperCase());
        });
      }
    }

    // Check if this line declares a directive for the NEXT line
    // e.g. // ucli-disable-next-line [RULE-001, ...] or /* ucli-disable-next-line */ or <!-- ucli-disable-next-line -->
    const disableNextMatch = line.match(/(?:\/\/|\/\*|<!--)\s*ucli-disable-next-line(?:\s+([A-Za-z0-9_-]+(?:[,\s]+[A-Za-z0-9_-]+)*))?/i);
    if (disableNextMatch) {
      nextLineDisabledRules = new Set();
      if (!disableNextMatch[1] || disableNextMatch[1].trim() === '') {
        nextLineDisabledRules.add('*');
      } else {
        disableNextMatch[1].split(/[,\s]+/).forEach(r => {
          if (r.trim()) nextLineDisabledRules.add(r.trim().toUpperCase());
        });
      }
    }

    // Skip empty lines or pure comment lines (directives above have already been captured)
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || (trimmed.startsWith('<!--') && trimmed.endsWith('-->'))) {
      return;
    }

    // Helper to register findings with config and disable-directive filtering
    function addFinding(ruleId, category, defaultSeverity, message) {
      // 1. Config severity check: if disabled ('off' / false / null), skip
      const configuredSev = configuredRules[ruleId];
      if (configuredSev === null) {
        return;
      }

      // 2. Inline directive check
      if (lineDisabledRules.has('*') || lineDisabledRules.has(ruleId.toUpperCase())) {
        return;
      }

      const severity = configuredSev || defaultSeverity;

      findings.push({
        file: relPath,
        line: lineNum,
        ruleId,
        category,
        severity,
        message,
        codeSnippet: trimmed
      });
    }

    // --- TAILWIND CSS AUDIT ---
    const twFoundHexes = new Set();
    if (mayHaveTailwind) {
      // 1. TAILWIND-002: Arbitrary Colors (e.g. bg-[#ff5733], text-[#333], hover:bg-[rgba(0,0,0,0.5)])
      const twColorRegex = /(?:[a-zA-Z0-9_-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|to|via|accent|shadow)-\[(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))\]/g;
      const colorMatches = [...line.matchAll(twColorRegex)];
      colorMatches.forEach(m => {
        const fullMatch = m[0];
        const rawColor = m[1];
        if (rawColor.startsWith('#')) {
          twFoundHexes.add(rawColor.toLowerCase());
        }
        addFinding(
          'TAILWIND-002',
          'Tokens',
          'ERROR',
          `Arbitrary Tailwind color '${fullMatch}' detected. Use semantic theme tokens or CSS variables.`
        );
      });

      // 2. TAILWIND-001: Arbitrary Spacing & Dimensions (e.g. p-[13px], m-[7px], gap-[15px], w-[23px])
      const twSpacingRegex = /(?:[a-zA-Z0-9_-]+:)*-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|top|bottom|left|right|inset|inset-x|inset-y|w|h|min-w|max-w|min-h|max-h|space-x|space-y)-\[(\d+(?:\.\d+)?)(px)?\]/g;
      const spacingMatches = [...line.matchAll(twSpacingRegex)];
      spacingMatches.forEach(m => {
        const fullMatch = m[0];
        const num = parseFloat(m[1]);
        if (isInvalidSpacing(num)) {
          addFinding(
            'TAILWIND-001',
            'Spacing',
            'WARNING',
            `Arbitrary Tailwind spacing '${fullMatch}' breaks standard ${grid}px design grid.`
          );
        }
      });
    }

    // --- 1. TOKEN AUDIT: Hardcoded colors ---
    // Match hex colors #rgb or #rrggbb or #rrggbbaa not defining a css custom property or SVG hex fill
    const hexMatch = line.match(/(?<!--[\w-]+:\s*|url\(|&|&#|#\s)(#[0-9a-fA-F]{3,8}\b)/g);
    if (hexMatch) {
      const isCustomPropDef = /^\s*--[\w-]+:/.test(line);
      if (!isCustomPropDef) {
        hexMatch.forEach(hex => {
          // If this hex was already reported as part of a Tailwind arbitrary color on this line, skip duplicate report
          if (twFoundHexes.has(hex.toLowerCase())) return;

          addFinding(
            'TOKEN-001',
            'Tokens',
            'ERROR',
            `Hardcoded color '${hex}' detected. Use a CSS variable or design token (e.g. 'var(--color-primary)').`
          );
        });
      }
    }

    // Match rgb/rgba/hsl values not inside var() or definition
    const colorFuncMatch = line.match(/\b(rgb|rgba|hsl|hsla)\s*\(/i);
    if (colorFuncMatch && !/^\s*--[\w-]+:/.test(line)) {
      addFinding(
        'TOKEN-002',
        'Tokens',
        'WARNING',
        `Raw color function '${colorFuncMatch[1]}()' detected. Prefer semantic design tokens.`
      );
    }

    // --- 2. SPACING SCALE AUDIT: Non-standard pixel spacing in CSS / Inline Styles ---
    // Ignore responsive media / container query conditions (e.g. @media (max-width: 899px))
    const isBreakpointLine = /^\s*@(media|container)\b/i.test(line) || /^\s*(?:and\s+)?\((?:min|max)-(?:width|height)\s*:\s*[^)]+\)/i.test(line);
    const spacingMatch = !isBreakpointLine
      ? line.match(/(margin|padding|gap|top|left|right|bottom|width|height|font-size)\s*:\s*([^\n;]+)/i)
      : null;

    if (spacingMatch) {
      const propName = spacingMatch[1].toLowerCase();
      const valStr = spacingMatch[2];
      // Strip any inline media feature conditions e.g. (max-width: 767px)
      const cleanValStr = valStr.replace(/\((?:min|max)-(?:width|height)\s*:\s*[^)]+\)/gi, '');
      const pxVals = cleanValStr.match(/\b(\d+)px\b/g);
      if (pxVals) {
        pxVals.forEach(pxToken => {
          const num = parseInt(pxToken.replace('px', ''), 10);
          if (isInvalidSpacing(num)) {
            addFinding(
              'SPACING-001',
              'Spacing',
              'WARNING',
              `Arbitrary spacing value '${pxToken}' on '${propName}' breaks standard ${grid}px design grid.`
            );
          }
        });
      }
    }

    // --- 3. ACCESSIBILITY (a11y) AUDIT ---
    if (isMarkup) {
      // A11Y-001: <img> tag without alt attribute
      if (/<img\b/i.test(line) && !/\balt\s*=/i.test(line)) {
        addFinding(
          'A11Y-001',
          'Accessibility',
          'ERROR',
          `Image '<img>' tag is missing an 'alt' attribute for screen readers.`
        );
      }

      // A11Y-002: Clickable non-interactive tags without ARIA role / tabIndex
      const hasOnClick = /\bonClick\b|\b@click\b|\bon:click\b/i.test(line);
      const isNonInteractive = /<(div|span|section|p|li)\b/i.test(line);
      if (hasOnClick && isNonInteractive) {
        const hasRole = /\brole\s*=\s*["'](?:button|link|menuitem|tab|checkbox|switch)["']/i.test(line);
        const hasTabIndex = /\btabIndex\b|\btabindex\b/i.test(line);
        if (!hasRole || !hasTabIndex) {
          addFinding(
            'A11Y-002',
            'Accessibility',
            'ERROR',
            `Clickable non-interactive element has click handler without 'role="button"' or 'tabIndex={0}'.`
          );
        }
      }

      // A11Y-003: Form inputs without label or aria-label
      if (/<(input|select|textarea)\b/i.test(line) && !/type=\s*["'](?:hidden|submit|reset|button)["']/i.test(line)) {
        const hasAria = /\baria-label\s*=|\baria-labelledby\s*=|\bid\s*=/i.test(line);
        if (!hasAria) {
          addFinding(
            'A11Y-003',
            'Accessibility',
            'WARNING',
            `Form input is missing 'id' (for label association) or 'aria-label'.`
          );
        }
      }

      // --- 4. TYPOGRAPHY & LAYOUT AUDIT ---
      // Heading hierarchy check: <h1> ... <h6>
      const headingMatch = line.match(/<h([1-6])\b/i);
      if (headingMatch) {
        const currentLevel = parseInt(headingMatch[1], 10);
        if (lastHeadingLevel > 0 && currentLevel > lastHeadingLevel + 1) {
          addFinding(
            'TYPO-001',
            'Typography',
            'WARNING',
            `Skipped heading hierarchy level: jumped from '<h${lastHeadingLevel}>' to '<h${currentLevel}>'.`
          );
        }
        lastHeadingLevel = currentLevel;
      }

      // Inline styles check
      if (/\bstyle\s*=\s*(?:\{|"|')/i.test(line) && !line.includes('style={{ display: "none" }}')) {
        addFinding(
          'LAYOUT-001',
          'Layout',
          'INFO',
          `Inline styles detected. Extract styles into CSS classes or style tokens for maintainability.`
        );
      }

      // Track nesting depth rough approximation
      const openTags = (line.match(/<(div|section|main|article|aside|header|footer|nav|ul|ol)\b/gi) || []).length;
      const closeTags = (line.match(/<\/(div|section|main|article|aside|header|footer|nav|ul|ol)>/gi) || []).length;
      currentNestingDepth = Math.max(0, currentNestingDepth + openTags - closeTags);
      if (currentNestingDepth > 6 && maxNestingDepth <= 6) {
        maxNestingDepth = currentNestingDepth;
        addFinding(
          'LAYOUT-002',
          'Layout',
          'INFO',
          `Deep DOM nesting detected (>6 levels). Consider simplifying component structure.`
        );
      }
    }

    // --- 5. PERFORMANCE & RENDERING AUDIT ---
    const perfAnimMatch = line.match(/(?:transition|animation)[\s:]*.*?([^,;{]*?\b(width|height|margin|padding|top|left|right|bottom)\b[^,;{]*)/i);
    if (perfAnimMatch && !line.includes('transform')) {
      addFinding(
        'PERF-001',
        'Performance',
        'WARNING',
        `Non-composited animation detected on '${perfAnimMatch[2]}'. Use 'transform' or 'opacity' to avoid expensive main-thread repaints.`
      );
    }

    if (/@font-face/i.test(line)) {
      addFinding(
        'PERF-004',
        'Performance',
        'INFO',
        `Ensure '@font-face' declarations include 'font-display: swap' to prevent invisible text during load.`
      );
    }

    if (isMarkup) {
      if (/<img\b/i.test(line)) {
        const hasWidth = /\bwidth\s*=/i.test(line);
        const hasHeight = /\bheight\s*=/i.test(line);
        if (!hasWidth || !hasHeight) {
          addFinding(
            'PERF-002',
            'Performance',
            'ERROR',
            `Image is missing explicit 'width' and 'height' attributes. This causes Cumulative Layout Shift (CLS).`
          );
        }
      }

      if (/<(?:img|video|iframe)\b/i.test(line)) {
        if (!/\bloading\s*=\s*["']lazy["']/i.test(line)) {
          addFinding(
            'PERF-003',
            'Performance',
            'WARNING',
            `Media element missing 'loading="lazy"'. Offscreen assets will block critical initial paints.`
          );
        }

        if (/\b(?:src|href)\s*=\s*["'][^"']*\.gif\b["']/i.test(line)) {
          addFinding(
            'PERF-003',
            'Performance',
            'WARNING',
            `Heavy '.gif' format detected. Prefer modern formats like '.webp' or '.mp4' for animations to reduce bandwidth.`
          );
        }
      }
    }

    // --- 6. FLUTTER (DART) AUDIT ---
    if (isFlutter) {
      const flutterColorMatch = line.match(/\bColor\(\s*0x[0-9a-fA-F]{8}\s*\)/i) || line.match(/\bColors\.(?:red|blue|green|yellow|orange|purple|pink|teal|cyan|amber|indigo|lime)\b(?:\[\d+\])?/i);
      if (flutterColorMatch && !/\bconst\s+[a-zA-Z0-9_]+\s*=/.test(line)) {
        addFinding(
          'TOKEN-003',
          'Tokens',
          'ERROR',
          `Hardcoded Flutter color '${flutterColorMatch[0]}' detected. Define colors in a centralized Theme or constant design token class.`
        );
      }

      const flutterSpacingMatch = line.match(/(?:EdgeInsets\.all\(\s*|height:\s*|width:\s*)([\d.]+)/);
      if (flutterSpacingMatch) {
        const valStr = flutterSpacingMatch[1];
        const num = parseFloat(valStr);
        if (isInvalidSpacing(num)) {
          addFinding(
            'SPACING-002',
            'Spacing',
            'WARNING',
            `Arbitrary Flutter spacing value '${num}' breaks standard ${grid}px design grid.`
          );
        }
      }

      if (/\b(?:GestureDetector|InkWell)\s*\(/.test(line)) {
        addFinding(
          'A11Y-004',
          'Accessibility',
          'WARNING',
          `Ensure clickable widget ('GestureDetector' or 'InkWell') provides adequate accessibility feedback or is wrapped in 'Semantics'.`
        );
      }

      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      currentNestingDepth = Math.max(0, currentNestingDepth + openParens - closeParens);
      if (currentNestingDepth > 8 && maxNestingDepth <= 8) {
        maxNestingDepth = currentNestingDepth;
        addFinding(
          'LAYOUT-003',
          'Layout',
          'INFO',
          `Deep widget nesting detected (>8 levels). Consider extracting widgets into smaller classes.`
        );
      }
    }

    // --- 7. ANDROID (XML) AUDIT ---
    if (isAndroidXml) {
      const androidColorMatch = line.match(/(?:android:textColor|android:background|app:tint|android:tint)\s*=\s*"*(#[0-9a-fA-F]{3,8})"/i);
      if (androidColorMatch) {
        addFinding(
          'TOKEN-004',
          'Tokens',
          'ERROR',
          `Hardcoded Android color '${androidColorMatch[1]}' detected. Use a centralized '@color/' or '?attr/' resource.`
        );
      }

      const androidTextMatch = line.match(/android:text\s*=\s*"([^@?][^"]*)"/i);
      if (androidTextMatch && !/^\s*$/.test(androidTextMatch[1]) && !/^\{.*\}$/.test(androidTextMatch[1])) {
        addFinding(
          'TOKEN-005',
          'Tokens',
          'WARNING',
          `Hardcoded string "${androidTextMatch[1]}" detected. Use a centralized '@string/' resource for localization.`
        );
      }

      const androidSpacingMatch = line.match(/(?:margin|padding)(?:Start|End|Top|Bottom|Left|Right)?\s*=\s*"(\d+)dp"/i);
      if (androidSpacingMatch) {
        const valStr = androidSpacingMatch[1];
        const num = parseInt(valStr, 10);
        if (isInvalidSpacing(num)) {
          addFinding(
            'SPACING-003',
            'Spacing',
            'WARNING',
            `Arbitrary Android spacing value '${num}dp' breaks standard ${grid}dp design grid.`
          );
        }
      }

      if (/<ImageView\b/i.test(line) && !/\bandroid:contentDescription\b/i.test(line)) {
        addFinding(
          'A11Y-005',
          'Accessibility',
          'ERROR',
          `Android '<ImageView>' is missing an 'android:contentDescription' attribute for screen readers.`
        );
      }
    }

    // --- 8. iOS (SWIFT) AUDIT ---
    if (isSwift) {
      const swiftColorMatch = line.match(/\bColor\(\s*(?:red|hex|uiColor|cgColor)\s*:/i);
      if (swiftColorMatch) {
        addFinding(
          'TOKEN-006',
          'Tokens',
          'ERROR',
          `Raw iOS Color initialization detected. Use semantic named colors like 'Color("BrandPrimary")'.`
        );
      }

      const swiftSpacingMatch = line.match(/\.padding\(\s*(?:\[[^\]]*\]\s*,\s*)?([\d.]+)\s*\)/i);
      if (swiftSpacingMatch) {
        const valStr = swiftSpacingMatch[1];
        const num = parseFloat(valStr);
        if (isInvalidSpacing(num)) {
          addFinding(
            'SPACING-004',
            'Spacing',
            'WARNING',
            `Arbitrary Swift spacing value '${num}' breaks standard ${grid}pt design grid.`
          );
        }
      }

      if (/\.onTapGesture\b/i.test(line)) {
        addFinding(
          'A11Y-006',
          'Accessibility',
          'INFO',
          `Interactive gesture detected. Ensure '.accessibilityLabel()' and '.accessibilityAddTraits(.isButton)' are applied.`
        );
      }
    }
  });

  return findings;
}

/**
 * Summarizes an array of findings into error/warning counts and a static health score.
 * @param {Array<Object>} findings
 * @param {number} totalFiles
 */
export function summarizeFindings(findings, totalFiles = 1) {
  const summary = {
    total: findings.length,
    errors: 0,
    warnings: 0,
    infos: 0,
    byCategory: {
      Tokens: { errors: 0, warnings: 0, infos: 0 },
      Spacing: { errors: 0, warnings: 0, infos: 0 },
      Accessibility: { errors: 0, warnings: 0, infos: 0 },
      Typography: { errors: 0, warnings: 0, infos: 0 },
      Layout: { errors: 0, warnings: 0, infos: 0 },
      Performance: { errors: 0, warnings: 0, infos: 0 }
    }
  };

  findings.forEach(f => {
    if (f.severity === 'ERROR') summary.errors++;
    else if (f.severity === 'WARNING') summary.warnings++;
    else if (f.severity === 'INFO') summary.infos++;

    const cat = summary.byCategory[f.category] || summary.byCategory.Layout;
    if (f.severity === 'ERROR') cat.errors++;
    else if (f.severity === 'WARNING') cat.warnings++;
    else if (f.severity === 'INFO') cat.infos++;
  });

  // Smart scoring algorithm based on project size
  const rawPenalty = (summary.errors * 6) + (summary.warnings * 3) + (summary.infos * 1);
  const penaltyFactor = rawPenalty / Math.max(1, totalFiles);
  const staticScore = Math.max(10, Math.round(100 - (penaltyFactor * 5)));

  return { summary, staticScore };
}

/**
 * Automatically fixes spacing violations by snapping arbitrary pixel values
 * to the nearest valid design grid increment.
 * Supports standard CSS declarations and arbitrary Tailwind classes.
 * @param {string} filePath - Absolute path to the file
 * @param {Object} [userConfig={}] - Configuration options
 * @returns {{ fixedCount: number, modified: boolean }}
 */
export function fixFile(filePath, userConfig = {}) {
  if (!fs.existsSync(filePath)) {
    return { fixedCount: 0, modified: false };
  }

  const grid = typeof userConfig.grid === 'number' && userConfig.grid > 0 ? userConfig.grid : 4;
  const allowedSpacing = userConfig.allowedSpacingSet || STANDARD_SPACING_PX;

  function snapValue(num) {
    if (num <= 0) return num;
    if (allowedSpacing.has(num)) return num;
    if (num % grid === 0) return num;
    const nearest = Math.round(num / grid) * grid;
    return nearest === 0 ? grid : nearest;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  let totalFixed = 0;
  let hasChanges = false;

  const ext = path.extname(filePath).toLowerCase();
  const isMarkup = ext === '.html' || ext === '.jsx' || ext === '.tsx' || ext === '.vue' || ext === '.svelte';
  const mayHaveTailwind = isMarkup || ext === '.css' || ext === '.scss' || ext === '.js' || ext === '.ts';

  const newLines = lines.map(line => {
    let modifiedLine = line;

    // Skip comments
    if (/^\s*(?:\/\/|\/\*|\*|<!--)/.test(line)) {
      return line;
    }
    // Skip media queries / breakpoints
    if (/^\s*@(media|container)\b/i.test(line) || /^\s*(?:and\s+)?\((?:min|max)-(?:width|height)\s*:\s*[^)]+\)/i.test(line)) {
      return line;
    }

    // 1. Fix arbitrary Tailwind spacing classes: e.g. p-[13px] -> p-[12px], gap-[15px] -> gap-[16px]
    if (mayHaveTailwind) {
      const twRegex = /((?:[a-zA-Z0-9_-]+:)*-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|top|bottom|left|right|inset|inset-x|inset-y|w|h|min-w|max-w|min-h|max-h|space-x|space-y)-\[)(\d+(?:\.\d+)?)(px)?(\])/g;
      modifiedLine = modifiedLine.replace(twRegex, (match, prefix, numStr, unit, suffix) => {
        const num = parseFloat(numStr);
        const snapped = snapValue(num);
        if (snapped !== num) {
          totalFixed++;
          hasChanges = true;
          return `${prefix}${snapped}${unit || ''}${suffix}`;
        }
        return match;
      });
    }

    // 2. Fix CSS spacing declarations
    const cssSpacingRegex = /((?:margin|padding|gap|top|left|right|bottom|width|height|font-size)\s*:\s*)([^\n;]+)(;?)/gi;
    modifiedLine = modifiedLine.replace(cssSpacingRegex, (fullMatch, propPrefix, valStr, semi) => {
      const fixedValStr = valStr.replace(/\b(\d+)px\b/g, (pxMatch, numStr) => {
        const num = parseInt(numStr, 10);
        const snapped = snapValue(num);
        if (snapped !== num) {
          totalFixed++;
          hasChanges = true;
          return `${snapped}px`;
        }
        return pxMatch;
      });
      return `${propPrefix}${fixedValStr}${semi}`;
    });

    return modifiedLine;
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
  }

  return { fixedCount: totalFixed, modified: hasChanges };
}
