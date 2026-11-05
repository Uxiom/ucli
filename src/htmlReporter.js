import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Generates an HTML dashboard and saves it to a temp file.
 * @returns {string} The absolute path to the generated HTML file.
 */
export function generateHtmlReport({ findings, staticSummary, staticScore }) {
  const categories = ['Tokens', 'Spacing', 'Accessibility', 'Typography', 'Layout', 'Performance'];

  const totalErrors = staticSummary.errors;
  const totalWarnings = staticSummary.warnings;
  const totalInfos = staticSummary.infos;
  const totalIssues = totalErrors + totalWarnings + totalInfos;

  const getPercentage = (val) => totalIssues === 0 ? 0 : Math.round((val / totalIssues) * 100);
  
  // Donut chart logic
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (staticScore / 100) * circumference;
  let scoreColor = '#ef4444'; // Red
  let scoreGlow = 'rgba(239, 68, 68, 0.5)';
  if (staticScore >= 90) { scoreColor = '#10b981'; scoreGlow = 'rgba(16, 185, 129, 0.5)'; }
  else if (staticScore >= 70) { scoreColor = '#a855f7'; scoreGlow = 'rgba(168, 85, 247, 0.5)'; }
  else if (staticScore >= 50) { scoreColor = '#f97316'; scoreGlow = 'rgba(249, 115, 22, 0.5)'; }

  const categoryCards = categories.map(cat => {
    const stats = staticSummary.byCategory[cat] || { errors: 0, warnings: 0, infos: 0 };
    const totalCat = stats.errors + stats.warnings + stats.infos;
    const hasErrors = stats.errors > 0;
    
    return `
      <div class="card cat-card ${hasErrors ? 'cat-error' : ''}">
        <div class="cat-header">
          <h3>${cat}</h3>
          <span class="cat-total">${totalCat}</span>
        </div>
        <div class="cat-bar-bg">
          <div class="cat-bar-fill ${hasErrors ? 'bg-red' : totalCat > 0 ? 'bg-purple' : 'bg-gray'}" style="width: ${totalCat === 0 ? 0 : Math.max(10, (totalCat/totalIssues)*100)}%"></div>
        </div>
        <div class="cat-footer">
          <span class="muted">Errors: ${stats.errors}</span>
          <span class="muted">Warn: ${stats.warnings}</span>
        </div>
      </div>
    `;
  }).join('');

  const findingsList = findings.map(item => {
    let badgeClass = 'badge-red';
    let badgeText = 'CRITICAL';
    if (item.severity === 'WARNING') {
      badgeClass = 'badge-purple';
      badgeText = 'WARNING';
    } else if (item.severity === 'INFO') {
      badgeClass = 'badge-cyan';
      badgeText = 'INFO';
    }

    const safeSnippet = item.codeSnippet ? item.codeSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

    return `
      <div class="finding-row">
        <div class="finding-badge ${badgeClass}">${badgeText}</div>
        <div class="finding-content">
          <div class="finding-meta">
            <span class="rule-id">${item.ruleId}</span>
            <span class="file-path">${item.file}:${item.line}</span>
          </div>
          <div class="finding-msg">${item.message}</div>
          ${safeSnippet ? `<div class="finding-code"><code>${safeSnippet}</code></div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ucli — Design System & UI/UX Audit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #09090b;
      --bg-card: #18181b;
      --bg-code: #000000;
      
      --border: #27272a;
      --border-light: #3f3f46;
      
      --text-main: #f8fafc;
      --text-muted: #a1a1aa;
      
      --red: #ef4444;
      --purple: #a855f7;
      --cyan: #0ea5e9;
      --green: #10b981;
      --orange: #f97316;
      --gray: #52525b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      line-height: 1.6;
      padding: 2rem;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    
    .title {
      font-size: 2rem;
      font-weight: 300;
      letter-spacing: -0.02em;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .title span { font-weight: 700; color: var(--purple); }

    /* Bento Grid */
    .bento-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 1.5rem;
      margin-bottom: 3rem;
    }
    
    @media (max-width: 768px) {
      .bento-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }

    /* Score Donut Chart */
    .score-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    
    .donut-wrapper {
      position: relative;
      width: 160px;
      height: 160px;
      margin-bottom: 1.5rem;
    }
    
    .donut-svg {
      transform: rotate(-90deg);
      width: 100%;
      height: 100%;
    }
    
    .donut-bg {
      fill: none;
      stroke: var(--border);
      stroke-width: 12;
    }
    
    .donut-fill {
      fill: none;
      stroke: ${scoreColor};
      stroke-width: 12;
      stroke-linecap: round;
      stroke-dasharray: ${circumference};
      stroke-dashoffset: ${strokeDashoffset};
      filter: drop-shadow(0 0 8px ${scoreGlow});
      transition: stroke-dashoffset 1s ease-out;
    }
    
    .donut-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 3.5rem;
      font-weight: 600;
      color: var(--text-main);
    }
    
    .score-label {
      font-size: 1.2rem;
      color: var(--text-muted);
      font-weight: 300;
    }

    /* Horizontal Bar Charts */
    .stats-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .stat-row {
      margin-bottom: 1.5rem;
    }
    .stat-row:last-child { margin-bottom: 0; }
    
    .stat-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 1.1rem;
      font-weight: 500;
    }
    
    .stat-header span.val { font-weight: 700; font-size: 1.2rem; }
    
    .stat-bar-bg {
      width: 100%;
      height: 12px;
      background: var(--bg-dark);
      border-radius: 99px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    
    .stat-bar-fill {
      height: 100%;
      border-radius: 99px;
    }
    
    .glow-red { background: var(--red); box-shadow: 0 0 12px rgba(239,68,68,0.6); width: ${getPercentage(totalErrors)}%; }
    .glow-purple { background: var(--purple); box-shadow: 0 0 12px rgba(168,85,247,0.6); width: ${getPercentage(totalWarnings)}%; }
    .glow-cyan { background: var(--cyan); box-shadow: 0 0 12px rgba(14,165,233,0.6); width: ${getPercentage(totalInfos)}%; }

    /* Categories Grid */
    .section-title {
      font-size: 1.5rem;
      font-weight: 400;
      margin-bottom: 1.5rem;
      color: var(--text-main);
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
    }

    .cat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 3rem;
    }
    
    .cat-card {
      padding: 1.5rem;
      border-radius: 12px;
      transition: border-color 0.2s;
    }
    .cat-error { border-color: rgba(239,68,68,0.3); background: linear-gradient(180deg, var(--bg-card) 0%, rgba(239,68,68,0.03) 100%); }
    
    .cat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .cat-header h3 { font-size: 1.2rem; font-weight: 500; }
    .cat-total { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
    
    .cat-bar-bg {
      width: 100%;
      height: 4px;
      background: var(--bg-dark);
      border-radius: 99px;
      margin-bottom: 1rem;
    }
    .cat-bar-fill { height: 100%; border-radius: 99px; }
    .bg-red { background: var(--red); box-shadow: 0 0 8px rgba(239,68,68,0.5); }
    .bg-purple { background: var(--purple); box-shadow: 0 0 8px rgba(168,85,247,0.5); }
    .bg-gray { background: var(--gray); }
    
    .cat-footer {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
    }
    .muted { color: var(--text-muted); }

    /* Findings List */
    .finding-row {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
    }

    @media (max-width: 600px) {
      .finding-row { flex-direction: column; gap: 1rem; }
    }

    .finding-badge {
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      min-width: 90px;
      text-align: center;
    }
    
    .badge-red { background: rgba(239,68,68,0.1); color: var(--red); border: 1px solid rgba(239,68,68,0.3); }
    .badge-purple { background: rgba(168,85,247,0.1); color: var(--purple); border: 1px solid rgba(168,85,247,0.3); }
    .badge-cyan { background: rgba(14,165,233,0.1); color: var(--cyan); border: 1px solid rgba(14,165,233,0.3); }

    .finding-content { flex: 1; min-width: 0; }
    
    .finding-meta {
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    .rule-id {
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-main);
      font-weight: 500;
      font-size: 0.95rem;
    }
    
    .file-path {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .finding-msg {
      font-size: 1.05rem;
      margin-bottom: 1rem;
      line-height: 1.5;
    }

    .finding-code {
      background-color: var(--bg-code);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
    }
    
    .finding-code code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      color: #e2e8f0;
    }

    .empty-state {
      padding: 4rem;
      text-align: center;
      background: var(--bg-card);
      border: 1px dashed var(--border-light);
      border-radius: 16px;
      font-size: 1.5rem;
      color: var(--green);
      font-weight: 300;
    }
  </style>
</head>
<body>
  <div class="container">
    
    <div class="title"><span>ucli</span> Design System Audit</div>
    
    <div class="bento-grid">
      <!-- Health Score Donut -->
      <div class="card score-card">
        <div class="donut-wrapper">
          <svg class="donut-svg" viewBox="0 0 160 160">
            <circle class="donut-bg" cx="80" cy="80" r="${radius}"></circle>
            <circle class="donut-fill" cx="80" cy="80" r="${radius}"></circle>
          </svg>
          <div class="donut-text">${staticScore}</div>
        </div>
        <div class="score-label">Overall Health Score</div>
      </div>
      
      <!-- Horizontal Stat Bars -->
      <div class="card stats-card">
        <div class="stat-row">
          <div class="stat-header">
            <span style="color: var(--red)">Critical Errors</span>
            <span class="val">${totalErrors}</span>
          </div>
          <div class="stat-bar-bg"><div class="stat-bar-fill glow-red"></div></div>
        </div>
        
        <div class="stat-row">
          <div class="stat-header">
            <span style="color: var(--purple)">Needs Fix (Warnings)</span>
            <span class="val">${totalWarnings}</span>
          </div>
          <div class="stat-bar-bg"><div class="stat-bar-fill glow-purple"></div></div>
        </div>
        
        <div class="stat-row">
          <div class="stat-header">
            <span style="color: var(--cyan)">Suggestions (Info)</span>
            <span class="val">${totalInfos}</span>
          </div>
          <div class="stat-bar-bg"><div class="stat-bar-fill glow-cyan"></div></div>
        </div>
      </div>
    </div>

    <div class="section-title">Category Breakdown</div>
    <div class="cat-grid">
      ${categoryCards}
    </div>

    <div class="section-title">Inspection Log</div>
    <div class="findings-list">
      ${findings.length === 0 ? '<div class="empty-state">✨ Flawless design system! No issues found.</div>' : findingsList}
    </div>
    
  </div>
</body>
</html>`;

  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `ucli-report-${Date.now()}.html`);
  fs.writeFileSync(filePath, html, 'utf8');
  return filePath;
}
