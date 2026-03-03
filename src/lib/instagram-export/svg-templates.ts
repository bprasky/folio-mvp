// SVG template helpers for Instagram carousel image generation

export type HeadlinePosition = 'bottom_left' | 'bottom_center' | 'top_left';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines;
}

export function createGradientOverlaySVG(
  width: number,
  height: number,
  position: HeadlinePosition
): string {
  const gradientId = 'textGradient';
  let gradientDef: string;

  if (position.startsWith('bottom')) {
    gradientDef = `<linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)" />
      <stop offset="50%" stop-color="rgba(0,0,0,0)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.65)" />
    </linearGradient>`;
  } else {
    gradientDef = `<linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.65)" />
      <stop offset="40%" stop-color="rgba(0,0,0,0)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0)" />
    </linearGradient>`;
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>${gradientDef}</defs>
    <rect width="${width}" height="${height}" fill="url(#${gradientId})" />
  </svg>`;
}

export function createHeadlineSVG(
  text: string,
  width: number,
  height: number,
  position: HeadlinePosition
): string {
  const fontSize = Math.round(width * 0.048);
  const padding = Math.round(width * 0.065);
  const lineHeight = fontSize * 1.25;

  const lines = wrapText(text, 25);
  const totalTextHeight = lines.length * lineHeight;

  let startY: number;
  if (position.startsWith('bottom')) {
    startY = height - padding - totalTextHeight + fontSize;
  } else {
    startY = padding + fontSize;
  }

  const xPos = position.endsWith('center') ? width / 2 : padding;
  const anchor = position.endsWith('center') ? 'middle' : 'start';

  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${xPos}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(`"${line}"`)}</tspan>`
    )
    .join('');

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="textShadow">
        <feDropShadow dx="0" dy="1" stdDeviation="4" flood-color="rgba(0,0,0,0.4)"/>
      </filter>
    </defs>
    <text
      x="${xPos}"
      y="${startY}"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${fontSize}"
      font-style="italic"
      fill="white"
      text-anchor="${anchor}"
      filter="url(#textShadow)"
    >${tspans}</text>
  </svg>`;
}

export type WatermarkStyle = 'folio_x' | 'folio_presents' | 'minimal';

export function createWatermarkSVG(
  watermarkStyle: WatermarkStyle,
  designerName: string,
  width: number,
  height: number,
  position: HeadlinePosition
): string {
  const fontSize = Math.round(width * 0.013);
  const padding = Math.round(width * 0.04);

  let watermarkText: string;
  switch (watermarkStyle) {
    case 'folio_x':
      watermarkText = `folio \u00D7 ${designerName}`;
      break;
    case 'folio_presents':
      watermarkText = `folio presents ${designerName}`;
      break;
    case 'minimal':
    default:
      watermarkText = 'folio';
      break;
  }

  // Watermark goes opposite to headline position
  let x: number;
  let y: number;
  let anchor: string;

  if (position.startsWith('bottom')) {
    // Headline is bottom, so watermark goes top-right
    x = width - padding;
    y = padding + fontSize;
    anchor = 'end';
  } else {
    // Headline is top, so watermark goes bottom-right
    x = width - padding;
    y = height - padding;
    anchor = 'end';
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="wmShadow">
        <feDropShadow dx="0" dy="0.5" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
      </filter>
    </defs>
    <text
      x="${x}"
      y="${y}"
      font-family="Helvetica Neue, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="400"
      letter-spacing="0.15em"
      text-transform="uppercase"
      fill="rgba(255,255,255,0.85)"
      text-anchor="${anchor}"
      filter="url(#wmShadow)"
    >${escapeXml(watermarkText.toUpperCase())}</text>
  </svg>`;
}

export function createBioSlideSVG(config: {
  designerName: string;
  designerTitle?: string;
  studioName?: string;
  bioText: string;
  width: number;
  height: number;
  photoHeight: number;
}): string {
  const { designerName, designerTitle, studioName, bioText, width, height, photoHeight } = config;
  const padding = Math.round(width * 0.08);
  const nameFontSize = Math.round(width * 0.042);
  const titleFontSize = Math.round(width * 0.024);
  const bioFontSize = Math.round(width * 0.028);

  const textStartY = photoHeight + Math.round(height * 0.08);

  const bioLines = wrapText(bioText, 40);
  const bioLineHeight = bioFontSize * 1.6;

  const bioTspans = bioLines
    .map(
      (line, i) =>
        `<tspan x="${padding}" dy="${i === 0 ? 0 : bioLineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="${padding}"
      y="${textStartY}"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${nameFontSize}"
      font-weight="500"
      fill="#2C2420"
    >${escapeXml(designerName)}</text>

    ${designerTitle || studioName ? `
    <text
      x="${padding}"
      y="${textStartY + nameFontSize * 1.4}"
      font-family="Helvetica Neue, Arial, sans-serif"
      font-size="${titleFontSize}"
      font-weight="400"
      letter-spacing="0.08em"
      fill="#8B7B68"
    >${escapeXml((designerTitle || '') + (studioName ? ` \u2014 ${studioName}` : ''))}</text>
    ` : ''}

    <line
      x1="${padding}"
      y1="${textStartY + nameFontSize * 2.2}"
      x2="${width - padding}"
      y2="${textStartY + nameFontSize * 2.2}"
      stroke="#C4B5A0"
      stroke-width="1"
    />

    <text
      x="${padding}"
      y="${textStartY + nameFontSize * 3.2}"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${bioFontSize}"
      font-style="italic"
      fill="#2C2420"
      line-height="${bioLineHeight}"
    >${bioTspans}</text>
  </svg>`;
}

export function createPhotoFadeSVG(width: number, photoHeight: number): string {
  return `<svg width="${width}" height="${photoHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="photoFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(245,240,235,0)" />
        <stop offset="70%" stop-color="rgba(245,240,235,0)" />
        <stop offset="100%" stop-color="rgba(245,240,235,1)" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${photoHeight}" fill="url(#photoFade)" />
  </svg>`;
}

export function createCTAContentSVG(config: {
  projectName: string;
  designerName: string;
  width: number;
  height: number;
}): string {
  const { projectName, designerName, width, height } = config;
  const centerX = width / 2;

  const headerFontSize = Math.round(width * 0.018);
  const logoFontSize = Math.round(width * 0.065);
  const projectFontSize = Math.round(width * 0.032);
  const bylineFontSize = Math.round(width * 0.022);
  const urlFontSize = Math.round(width * 0.016);

  const topY = Math.round(height * 0.32);
  const logoY = topY + headerFontSize * 2.5;
  const ruleY = logoY + logoFontSize * 1.8;
  const projectY = ruleY + Math.round(height * 0.06);
  const bylineY = projectY + projectFontSize * 1.6;
  const urlY = height - Math.round(height * 0.08);

  const projectLines = wrapText(projectName, 30);
  const projectLineHeight = projectFontSize * 1.3;
  const projectTspans = projectLines
    .map(
      (line, i) =>
        `<tspan x="${centerX}" dy="${i === 0 ? 0 : projectLineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  const padding = Math.round(width * 0.15);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="${centerX}"
      y="${topY}"
      font-family="Helvetica Neue, Arial, sans-serif"
      font-size="${headerFontSize}"
      font-weight="400"
      letter-spacing="0.25em"
      fill="#8B7B68"
      text-anchor="middle"
    >FULL EDITORIAL</text>

    <text
      x="${centerX}"
      y="${logoY}"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${logoFontSize}"
      font-style="italic"
      fill="#2C2420"
      text-anchor="middle"
    >folio</text>

    <line
      x1="${padding}"
      y1="${ruleY}"
      x2="${width - padding}"
      y2="${ruleY}"
      stroke="#C4B5A0"
      stroke-width="1"
    />

    <text
      x="${centerX}"
      y="${projectY}"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${projectFontSize}"
      font-weight="400"
      fill="#2C2420"
      text-anchor="middle"
    >${projectTspans}</text>

    <text
      x="${centerX}"
      y="${bylineY + (projectLines.length - 1) * projectLineHeight}"
      font-family="Helvetica Neue, Arial, sans-serif"
      font-size="${bylineFontSize}"
      font-weight="300"
      fill="#8B7B68"
      text-anchor="middle"
    >by ${escapeXml(designerName)}</text>

    <text
      x="${centerX}"
      y="${urlY}"
      font-family="Helvetica Neue, Arial, sans-serif"
      font-size="${urlFontSize}"
      font-weight="400"
      letter-spacing="0.12em"
      fill="#A89880"
      text-anchor="middle"
    >FOLIOAD.COM</text>
  </svg>`;
}
