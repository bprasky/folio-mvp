/**
 * Share Card Templates
 * SVG/HTML templates for generating share card images
 */

import type { ShareCardData, ShareCardConfig, ShareCardVariant } from './types';
import { VARIANT_CONFIGS } from './types';

/**
 * Escape HTML entities for SVG text
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Wrap text to fit within a certain width (approximate)
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

/**
 * Generate Folio logo SVG (simplified wordmark)
 */
function getFolioLogo(color: string): string {
  return `
    <g fill="${color}" transform="translate(0, 0)">
      <text font-family="Georgia, serif" font-size="18" font-weight="500" letter-spacing="2">
        FOLIO
      </text>
    </g>
  `;
}

/**
 * Generate SVG template for Instagram Story (1080x1920)
 */
function generateInstagramStoryTemplate(data: ShareCardData, config: ShareCardConfig): string {
  const { quote, attribution, userTitle, articleTitle, articleUrl } = data;
  const { width, height, backgroundColor, textColor, accentColor } = config;

  const escapedQuote = escapeHtml(quote);
  const escapedAttribution = escapeHtml(attribution);
  const escapedTitle = escapeHtml(articleTitle);

  // Wrap quote text
  const quoteLines = wrapText(quote, 28);
  const quoteFontSize = quoteLines.length > 6 ? 42 : 48;
  const lineHeight = quoteFontSize * 1.4;
  const quoteStartY = height / 2 - (quoteLines.length * lineHeight) / 2;

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>

  <!-- Decorative accent bar at top -->
  <rect x="0" y="0" width="${width}" height="8" fill="${accentColor}"/>

  <!-- Opening quote mark -->
  <text x="80" y="${quoteStartY - 60}" font-family="Georgia, serif" font-size="120" fill="${accentColor}" opacity="0.3">"</text>

  <!-- Quote text -->
  ${quoteLines.map((line, i) => `
  <text x="${width / 2}" y="${quoteStartY + i * lineHeight}"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="${quoteFontSize}"
        fill="${textColor}">${escapeHtml(line)}</text>
  `).join('')}

  <!-- Attribution -->
  <text x="${width / 2}" y="${quoteStartY + quoteLines.length * lineHeight + 60}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="28"
        fill="${textColor}"
        font-weight="500">— ${escapedAttribution}</text>
  ${userTitle ? `
  <text x="${width / 2}" y="${quoteStartY + quoteLines.length * lineHeight + 100}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="22"
        fill="${textColor}"
        opacity="0.7">${escapeHtml(userTitle)}</text>
  ` : ''}

  <!-- Article title at bottom -->
  <text x="${width / 2}" y="${height - 180}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="24"
        fill="${textColor}"
        opacity="0.6">${escapedTitle}</text>

  <!-- Read on Folio CTA -->
  <text x="${width / 2}" y="${height - 130}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="22"
        fill="${accentColor}">Read on Folio →</text>

  <!-- Folio logo -->
  <g transform="translate(${width - 120}, ${height - 60})">
    <text font-family="Georgia, serif" font-size="18" fill="${textColor}" opacity="0.5" letter-spacing="2">FOLIO</text>
  </g>
</svg>
  `.trim();
}

/**
 * Generate SVG template for Instagram Post (1080x1080)
 */
function generateInstagramPostTemplate(data: ShareCardData, config: ShareCardConfig): string {
  const { quote, attribution, userTitle, articleTitle } = data;
  const { width, height, backgroundColor, textColor, accentColor } = config;

  const quoteLines = wrapText(quote, 32);
  const quoteFontSize = quoteLines.length > 4 ? 36 : 42;
  const lineHeight = quoteFontSize * 1.4;
  const quoteStartY = height / 2 - (quoteLines.length * lineHeight) / 2;

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>

  <!-- Decorative accent bar at top -->
  <rect x="0" y="0" width="${width}" height="6" fill="${accentColor}"/>

  <!-- Opening quote mark -->
  <text x="60" y="${quoteStartY - 40}" font-family="Georgia, serif" font-size="100" fill="${accentColor}" opacity="0.3">"</text>

  <!-- Quote text -->
  ${quoteLines.map((line, i) => `
  <text x="${width / 2}" y="${quoteStartY + i * lineHeight}"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="${quoteFontSize}"
        fill="${textColor}">${escapeHtml(line)}</text>
  `).join('')}

  <!-- Attribution -->
  <text x="${width / 2}" y="${quoteStartY + quoteLines.length * lineHeight + 50}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="26"
        fill="${textColor}"
        font-weight="500">— ${escapeHtml(attribution)}</text>
  ${userTitle ? `
  <text x="${width / 2}" y="${quoteStartY + quoteLines.length * lineHeight + 85}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="20"
        fill="${textColor}"
        opacity="0.7">${escapeHtml(userTitle)}</text>
  ` : ''}

  <!-- Article title at bottom -->
  <text x="${width / 2}" y="${height - 100}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="20"
        fill="${textColor}"
        opacity="0.6">${escapeHtml(articleTitle)}</text>

  <!-- Read on Folio CTA -->
  <text x="${width / 2}" y="${height - 60}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="20"
        fill="${accentColor}">Read on Folio →</text>
</svg>
  `.trim();
}

/**
 * Generate SVG template for LinkedIn (1200x627)
 */
function generateLinkedInTemplate(data: ShareCardData, config: ShareCardConfig): string {
  const { quote, attribution, userTitle, articleTitle } = data;
  const { width, height, backgroundColor, textColor, accentColor } = config;

  const quoteLines = wrapText(quote, 50);
  const quoteFontSize = quoteLines.length > 3 ? 28 : 32;
  const lineHeight = quoteFontSize * 1.4;
  const quoteStartY = height / 2 - (quoteLines.length * lineHeight) / 2 - 20;

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>

  <!-- Decorative accent bar at left -->
  <rect x="0" y="0" width="6" height="${height}" fill="${accentColor}"/>

  <!-- Quote text -->
  <text x="60" y="${quoteStartY - 30}" font-family="Georgia, serif" font-size="60" fill="${accentColor}" opacity="0.3">"</text>
  ${quoteLines.map((line, i) => `
  <text x="80" y="${quoteStartY + i * lineHeight + 20}"
        font-family="Georgia, serif"
        font-size="${quoteFontSize}"
        fill="${textColor}">${escapeHtml(line)}</text>
  `).join('')}

  <!-- Attribution -->
  <text x="80" y="${quoteStartY + quoteLines.length * lineHeight + 50}"
        font-family="system-ui, sans-serif"
        font-size="22"
        fill="${textColor}"
        font-weight="500">— ${escapeHtml(attribution)}${userTitle ? `, ${escapeHtml(userTitle)}` : ''}</text>

  <!-- Article title at bottom -->
  <text x="80" y="${height - 50}"
        font-family="system-ui, sans-serif"
        font-size="18"
        fill="${textColor}"
        opacity="0.6">${escapeHtml(articleTitle)} · Read on Folio</text>

  <!-- Folio logo -->
  <g transform="translate(${width - 100}, ${height - 50})">
    <text font-family="Georgia, serif" font-size="16" fill="${textColor}" opacity="0.5" letter-spacing="2">FOLIO</text>
  </g>
</svg>
  `.trim();
}

/**
 * Generate SVG template for Twitter/X (1200x675)
 */
function generateTwitterTemplate(data: ShareCardData, config: ShareCardConfig): string {
  const { quote, attribution, userTitle, articleTitle } = data;
  const { width, height, backgroundColor, textColor, accentColor } = config;

  const quoteLines = wrapText(quote, 48);
  const quoteFontSize = quoteLines.length > 3 ? 28 : 32;
  const lineHeight = quoteFontSize * 1.4;
  const quoteStartY = height / 2 - (quoteLines.length * lineHeight) / 2 - 10;

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>

  <!-- Decorative accent bar at top -->
  <rect x="0" y="0" width="${width}" height="5" fill="${accentColor}"/>

  <!-- Quote text -->
  <text x="60" y="${quoteStartY - 20}" font-family="Georgia, serif" font-size="60" fill="${accentColor}" opacity="0.3">"</text>
  ${quoteLines.map((line, i) => `
  <text x="${width / 2}" y="${quoteStartY + i * lineHeight + 20}"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="${quoteFontSize}"
        fill="${textColor}">${escapeHtml(line)}</text>
  `).join('')}

  <!-- Attribution -->
  <text x="${width / 2}" y="${quoteStartY + quoteLines.length * lineHeight + 50}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="22"
        fill="${textColor}"
        font-weight="500">— ${escapeHtml(attribution)}${userTitle ? `, ${escapeHtml(userTitle)}` : ''}</text>

  <!-- Article title and CTA at bottom -->
  <text x="${width / 2}" y="${height - 40}"
        text-anchor="middle"
        font-family="system-ui, sans-serif"
        font-size="18"
        fill="${textColor}"
        opacity="0.6">${escapeHtml(articleTitle)} · <tspan fill="${accentColor}">Read on Folio</tspan></text>
</svg>
  `.trim();
}

/**
 * Generate SVG template for a share card
 */
export function generateShareCardSvg(data: ShareCardData): string {
  const config = VARIANT_CONFIGS[data.variant];

  switch (data.variant) {
    case 'instagram_story':
      return generateInstagramStoryTemplate(data, config);
    case 'instagram_post':
      return generateInstagramPostTemplate(data, config);
    case 'linkedin':
      return generateLinkedInTemplate(data, config);
    case 'twitter':
      return generateTwitterTemplate(data, config);
    default:
      return generateInstagramPostTemplate(data, config);
  }
}

/**
 * Truncate quote to fit nicely on share card
 */
export function truncateQuote(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;

  // Find a good break point (end of sentence or clause)
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastComma = truncated.lastIndexOf(',');
  const lastSpace = truncated.lastIndexOf(' ');

  // Prefer breaking at sentence end, then comma, then space
  if (lastPeriod > maxLength * 0.6) {
    return truncated.slice(0, lastPeriod + 1);
  }
  if (lastComma > maxLength * 0.6) {
    return truncated.slice(0, lastComma) + '...';
  }
  if (lastSpace > maxLength * 0.6) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}
