# ucli — Fast Offline Design System Linter & UI/UX Auditor

[![npm version](https://img.shields.io/npm/v/@uxiom/ucli.svg)](https://www.npmjs.com/package/@uxiom/ucli)
[![npm downloads](https://img.shields.io/npm/dt/@uxiom/ucli.svg)](https://www.npmjs.com/package/@uxiom/ucli)
[![license](https://img.shields.io/npm/l/@uxiom/ucli.svg)](LICENSE)
![100% Offline](https://img.shields.io/badge/offline-100%25-brightgreen)

`ucli` is a blazing-fast, 100% offline static design system linter, Tailwind auditor, and UI/UX inspector. It scans your frontend components, stylesheets, and mobile code to enforce design tokens, detect arbitrary spacing escape hatches, and prevent accessibility and layout performance bottlenecks.

---

## ⚡ What's New in v1.2.x

* **Project Configuration (`.uclirc.json` / `ucli.config.json`)**: Configure custom spacing grids (e.g., 4px, 8px, 10px), customized allowed scales, rule severities, and ignore globs.
* **`ucli init` Command**: Scaffolds a starter configuration file in your project with a single command.
* **Tailwind CSS Arbitrary Value Audits**:
  * `TAILWIND-001`: Flags arbitrary pixel spacing classes like `p-[13px]`, `m-[7px]`, `gap-[15px]`, `w-[37px]`.
  * `TAILWIND-002`: Flags arbitrary color escapes like `bg-[#ff5733]`, `text-[#333333]`, or `hover:bg-[rgba(...)]` that bypass semantic theme tokens.
* **Inline Comment Directives**: Suppress rules on individual lines using standard comments (`// ucli-disable-next-line RULE-ID` or `/* ucli-disable-line */`).
* **Custom Config Path (`--config <path>`)**: Run scans using dedicated environment or workspace configuration files.

---

## 🚀 Installation

Run directly with `npx` (no install required):

```bash
npx @uxiom/ucli scan
```

Or install globally:

```bash
npm install -g @uxiom/ucli
```

---

## 🛠 Usage & Commands

### 1. Initialize Configuration
Scaffold a `.uclirc.json` file in your project root:

```bash
ucli init
```

### 2. Run a Scan
Scan the current directory or target a specific folder:

```bash
# Scan current project
ucli scan

# Scan a specific component folder
ucli scan ./src/components

# Use a custom configuration file
ucli scan ./src --config ./custom-ucli.json
```

### 3. Headless / CI Mode
Run without automatically launching the visual HTML dashboard in your browser:

```bash
ucli scan ./src --no-open
```

### 4. Machine-Readable JSON Output
Pipe structured audit findings into CI/CD scripts or quality gates:

```bash
ucli scan ./src --json
```

---

## ⚙ Configuration (`.uclirc.json`)

Customize grid dimensions, token enforcement, and rules by placing a `.uclirc.json` or `ucli.config.json` in your project root:

```json
{
  "grid": 4,
  "allowedSpacing": [
    0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 64, 80, 96, 128
  ],
  "rules": {
    "TOKEN-001": "error",
    "SPACING-001": "warning",
    "TAILWIND-001": "warning",
    "TAILWIND-002": "error",
    "A11Y-001": "error",
    "A11Y-002": "error",
    "PERF-001": "warning",
    "PERF-002": "error",
    "LAYOUT-001": "off"
  },
  "ignore": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**"
  ]
}
```

### Rule Severity Levels
* `"error"` (or `true` / `2`): Fails the scan with exit code `1` in CI/CD.
* `"warning"` (or `1`): Emits a warning on the scorecard.
* `"info"` (or `3`): Informational notice.
* `"off"` (or `false` / `0`): Disables the rule completely.

---

## 💬 Inline Rule Suppressions

To bypass a rule for an intentional one-off, add standard comment directives in JavaScript, TypeScript, JSX, CSS, or HTML:

```jsx
// Disable all rules for the next line:
// ucli-disable-next-line
<div style={{ marginTop: '13px' }} />

// Disable a specific rule for the next line:
// ucli-disable-next-line TAILWIND-001
<div className="p-[13px] bg-slate-100" />

// Disable a specific rule on the current line:
<div className="bg-[#ff5733]" /> {/* ucli-disable-line TAILWIND-002 */}
```

---

## 📋 Comprehensive Rule Reference

| Rule ID | Category | Default | Description |
| :--- | :--- | :--- | :--- |
| **`TOKEN-001`** | Tokens | `ERROR` | Hardcoded hex colors (`#fff`). Use CSS variables or theme tokens. |
| **`TOKEN-002`** | Tokens | `WARNING` | Raw `rgb()` or `hsl()` function calls bypassing semantic tokens. |
| **`TOKEN-003`** | Tokens | `ERROR` | Hardcoded Flutter `Color(0x...)` or raw palette color. |
| **`TOKEN-004`** | Tokens | `ERROR` | Hardcoded Android XML hex color (`android:textColor="#..."`). |
| **`TOKEN-005`** | Tokens | `WARNING` | Hardcoded string literal in Android XML without `@string/` resource. |
| **`TOKEN-006`** | Tokens | `ERROR` | Raw iOS SwiftUI `Color(red:green:blue:)` initialization. |
| **`SPACING-001`** | Spacing | `WARNING` | CSS pixel spacing breaking the 4px/8px modular grid. |
| **`SPACING-002`** | Spacing | `WARNING` | Flutter `EdgeInsets` or `SizedBox` breaking grid scale. |
| **`SPACING-003`** | Spacing | `WARNING` | Android XML `dp` padding/margin breaking grid scale. |
| **`SPACING-004`** | Spacing | `WARNING` | SwiftUI `.padding()` value breaking point grid scale. |
| **`TAILWIND-001`** | Spacing | `WARNING` | Arbitrary Tailwind spacing like `p-[13px]`, `m-[7px]`, `w-[37px]`. |
| **`TAILWIND-002`** | Tokens | `ERROR` | Arbitrary Tailwind colors like `bg-[#ff5733]` or `text-[#333]`. |
| **`A11Y-001`** | Accessibility | `ERROR` | `<img>` tag missing an `alt` attribute for screen readers. |
| **`A11Y-002`** | Accessibility | `ERROR` | Clickable non-interactive element missing `role="button"` or `tabIndex`. |
| **`A11Y-003`** | Accessibility | `WARNING` | Form input missing `id` (for `<label>`) or `aria-label`. |
| **`A11Y-004`** | Accessibility | `WARNING` | Flutter `GestureDetector` or `InkWell` without semantics feedback. |
| **`A11Y-005`** | Accessibility | `ERROR` | Android `<ImageView>` missing `android:contentDescription`. |
| **`A11Y-006`** | Accessibility | `INFO` | SwiftUI `.onTapGesture` missing `.accessibilityLabel()`. |
| **`TYPO-001`** | Typography | `WARNING` | Skipped heading hierarchy level (e.g. `<h1>` jumped directly to `<h3>`). |
| **`LAYOUT-001`** | Layout | `INFO` | Inline `style="..."` attribute detected. |
| **`LAYOUT-002`** | Layout | `INFO` | Deep DOM nesting detected (> 6 levels). |
| **`LAYOUT-003`** | Layout | `INFO` | Deep Flutter widget nesting detected (> 8 levels). |
| **`PERF-001`** | Performance | `WARNING` | Non-composited animation animating layout properties (`width`, `margin`). |
| **`PERF-002`** | Performance | `ERROR` | Image missing explicit `width` and `height` attributes (causes CLS). |
| **`PERF-003`** | Performance | `WARNING` | Media missing `loading="lazy"` or heavy animated `.gif` format. |
| **`PERF-004`** | Performance | `INFO` | `@font-face` missing `font-display: swap` (causes FOIT). |

---

## 🌐 Supported Frameworks & Extensions

`ucli` inspects your codebase offline across frontend, web, and mobile ecosystems:
* **Web & Components**: `.html`, `.jsx`, `.tsx`, `.vue`, `.svelte`
* **Tailwind & Stylesheets**: `.css`, `.scss`, `.less`
* **Mobile Platforms**: `.dart` (Flutter), `.xml` (Android), `.swift` (iOS/SwiftUI)
* **Logic & Scripts**: `.js`, `.ts`

---

## 🤖 GitHub Actions CI/CD Integration

Add a design system check directly into your pull request pipeline:

```yaml
# .github/workflows/design-system.yml
name: UI/UX & Design System Audit

on: [push, pull_request]

jobs:
  ucli-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run ucli static inspection
        run: npx @uxiom/ucli scan ./src --no-open
```

---

## 💻 CLI Options Reference

```
Usage: ucli [command] [options]

Commands:
  init                     Initialize a default .uclirc.json configuration file
  scan [directory]         Scan a frontend directory or file for violations

Options:
  -v, --version            Output current ucli version
  -c, --config <path>      Path to custom ucli configuration file
  -i, --ignore <patterns>  Additional glob patterns to ignore
  -j, --json               Output results in JSON format
  --no-open                Prevent the HTML dashboard from opening automatically
  -h, --help               Display help information
```

---

## 📄 License

MIT © [Uxiom](https://github.com/uxiom)
