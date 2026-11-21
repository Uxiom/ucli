/**
 * Generates an SVG UI Health Badge for READMEs and dashboards.
 * @param {number} score - Health score (0 - 100)
 * @param {string} grade - Letter grade (e.g. 'A+', 'A', 'B', etc.)
 * @returns {string} SVG markup
 */
export function generateBadgeSvg(score, grade = 'A+') {
  let color = '#22c55e'; // green (A+, A)
  if (score < 50) color = '#ef4444'; // red (F)
  else if (score < 65) color = '#f97316'; // orange (D)
  else if (score < 75) color = '#eab308'; // yellow (C)
  else if (score < 85) color = '#3b82f6'; // blue (B)

  const leftWidth = 72;
  const rightWidth = 92;
  const totalWidth = leftWidth + rightWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="UI Health: ${grade} (${score}/100)">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="1" stop-opacity=".12"/>
  </linearGradient>
  <mask id="a">
    <rect width="${totalWidth}" height="20" rx="4" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <rect width="${leftWidth}" height="20" fill="#18181b"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" font-weight="600">
    <text x="${leftWidth / 2}" y="14.5" fill="#a1a1aa">ui health</text>
    <text x="${leftWidth + (rightWidth / 2)}" y="14.5">${grade} ${score}/100</text>
  </g>
</svg>
`;
}
