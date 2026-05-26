/**
 * slide-svg.ts  — CLIENT-SAFE, authoritative slide SVG builder
 *
 * Shared by both the browser preview and the server-side Sharp renderer.
 * No Node.js / sharp imports — safe to import anywhere.
 */

// ─── Font ─────────────────────────────────────────────────────────────────────

export type FontKey =
  | 'default' | 'bebas' | 'inter' | 'anton'
  | 'oswald' | 'playfair' | 'montserrat';

const FONT_FAMILIES: Record<FontKey, string> = {
  default:    'Helvetica Neue, Arial, sans-serif',
  bebas:      '"Bebas Neue", Impact, sans-serif',
  inter:      '"Inter", "Helvetica Neue", Arial, sans-serif',
  anton:      '"Anton", Impact, sans-serif',
  oswald:     '"Oswald", "Arial Narrow", Arial, sans-serif',
  playfair:   '"Playfair Display", Georgia, serif',
  montserrat: '"Montserrat", "Helvetica Neue", Arial, sans-serif',
};

// Single Google Fonts import URL covering all font choices
const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Bebas+Neue' +
  '&family=Inter:wght@400;700;800' +
  '&family=Anton' +
  '&family=Oswald:wght@400;700' +
  '&family=Playfair+Display:wght@400;700;800' +
  '&family=Montserrat:wght@400;700;800' +
  '&display=swap';

// ─── Content type ─────────────────────────────────────────────────────────────

export interface SlideContent {
  chip?: string;
  headline: string;
  body?: string;
  accent?: string;
  // Position overrides from editor (0–100 % of canvas, center of element)
  chipPos?:     { x: number; y: number };
  headlinePos?: { x: number; y: number };
  bodyPos?:     { x: number; y: number };
  accentPos?:   { x: number; y: number };
  // Font / size / width overrides (match PreviewEditor API)
  hlFont?:        FontKey;
  hlFontSize?:    number;   // px on the 1080-px canvas; overrides auto-size
  hlWidth?:       number;   // px width of headline text block (default 780)
  bodyFont?:      FontKey;
  bodyFontSize?:  number;   // px on the 1080-px canvas
  bodyWidth?:     number;   // px width of body text block (default 780)
  // Optional overlay image (base64 data URL or CDN URL)
  imageDataUrl?: string;
  imageX?: number;  // center % of canvas width  (default 50)
  imageY?: number;  // center % of canvas height (default 30)
  imageW?: number;  // width % of canvas width   (default 40)
  imageH?: number;  // height % of canvas height (default 25)
}

// ─── Colours ──────────────────────────────────────────────────────────────────
const BG       = '#0d1117';
const CHIP_BG  = '#1a2744';
const CHIP_FG  = '#5ce1ff';
const HEADLINE = '#ffffff';
const BODY_FG  = '#b0bec5';
const ACCENT   = '#5ce1ff';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function stripHtmlForSvg(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

function xmlEsc(s: string) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compute max chars per line from text-block width (px) and font size (px).
 * Approximates average char width as 55 % of em-size — validated against the
 * hardcoded values used before this change (14/16/19 at 102/88/76 px, 780 px wide).
 */
function maxCharsFromWidth(widthPx: number, fontSize: number): number {
  return Math.max(8, Math.round(widthPx / (fontSize * 0.55)));
}

/**
 * Word-wrap by character count. Identical behaviour in browser and server —
 * purely character-based, font metrics don't affect line breaks.
 */
function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.trim().split(/\s+/);
    let cur = '';
    for (const w of words) {
      const c = cur ? `${cur} ${w}` : w;
      if (c.length <= maxChars) { cur = c; }
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
  }
  return lines.length > 0 ? lines : [''];
}

function svgText(opts: {
  lines: string[]; x: number; startY: number;
  fontSize: number; lineHeight: number; fill: string;
  fontFamily: string;
  fontWeight?: string; letterSpacing?: number;
}): string {
  const {
    lines, x, startY, fontSize, lineHeight, fill, fontFamily,
    fontWeight = 'normal', letterSpacing = 0,
  } = opts;
  const tspans = lines
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${xmlEsc(l)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${startY}"
    font-family="${fontFamily}"
    font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}"
    text-anchor="middle" letter-spacing="${letterSpacing}">${tspans}</text>`;
}

// ─── Main builder ──────────────────────────────────────────────────────────────

export function buildSlideSvg(content: SlideContent): string {
  const W = 1080, H = 1920, CX = W / 2;

  const chip     = stripHtmlForSvg(content.chip    ?? '');
  const headline = stripHtmlForSvg(content.headline);
  const body     = stripHtmlForSvg(content.body    ?? '');
  const accent   = stripHtmlForSvg(content.accent  ?? '');

  const px = (pct: number, dim: number) => Math.round((pct / 100) * dim);

  const hlFontFamily   = FONT_FAMILIES[content.hlFont   ?? 'default'];
  const bodyFontFamily = FONT_FAMILIES[content.bodyFont ?? 'default'];

  // ── Image (renders between background and text) ──────────────────────────
  const imageParts: string[] = [];
  if (content.imageDataUrl) {
    const imgX = content.imageX ?? 50;
    const imgY = content.imageY ?? 30;
    const imgW = content.imageW ?? 40;
    const imgH = content.imageH ?? 25;
    const pxW  = Math.round((imgW / 100) * W);
    const pxH  = Math.round((imgH / 100) * H);
    const pxX  = Math.round((imgX / 100) * W) - Math.round(pxW / 2);
    const pxY  = Math.round((imgY / 100) * H) - Math.round(pxH / 2);
    imageParts.push(
      `<image href="${content.imageDataUrl}" x="${pxX}" y="${pxY}" width="${pxW}" height="${pxH}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  // ── Text elements ─────────────────────────────────────────────────────────
  const textParts: string[] = [];

  // Chip / label
  if (chip) {
    const upper = chip.toUpperCase();
    const cx = content.chipPos ? px(content.chipPos.x, W) : CX;
    const cy = content.chipPos ? px(content.chipPos.y, H) : 210;
    const cw = Math.min(upper.length * 22 + 64, 600), ch = 72;
    textParts.push(
      `<rect x="${cx - cw / 2}" y="${cy - ch / 2}" width="${cw}" height="${ch}" rx="36" fill="${CHIP_BG}"/>`,
      `<text x="${cx}" y="${cy + 10}" font-family="Helvetica Neue, Arial, sans-serif"
        font-size="28" font-weight="700" fill="${CHIP_FG}" text-anchor="middle" letter-spacing="3">${xmlEsc(upper)}</text>`,
    );
  }

  // Headline — font size: explicit override > auto from word count
  const hw  = headline.split(/\s+/).length;
  const autoHfs = hw <= 5 ? 102 : hw <= 8 ? 88 : 76;
  const hfs = content.hlFontSize ?? autoHfs;
  const hlh = Math.round(hfs * 1.18);   // line-height ≈ 1.18× font-size
  const hlW = content.hlWidth ?? 780;
  const hlines = wrapText(headline, maxCharsFromWidth(hlW, hfs));
  const hcy = content.headlinePos ? px(content.headlinePos.y, H) : (chip ? 480 : 380);
  const hsy = hcy - ((hlines.length - 1) * hlh) / 2;
  textParts.push(svgText({
    lines: hlines,
    x: content.headlinePos ? px(content.headlinePos.x, W) : CX,
    startY: hsy + hfs * 0.35,
    fontSize: hfs, lineHeight: hlh,
    fill: HEADLINE, fontFamily: hlFontFamily,
    fontWeight: '800', letterSpacing: -1,
  }));

  // Body
  if (body) {
    const bfs  = content.bodyFontSize ?? 46;
    const blh  = Math.round(bfs * 1.39);   // ≈ 64 px for default 46-px body
    const bW   = content.bodyWidth ?? 780;
    const blines = wrapText(body, maxCharsFromWidth(bW, bfs));
    const bcy  = content.bodyPos ? px(content.bodyPos.y, H) : 1040;
    textParts.push(svgText({
      lines: blines,
      x: content.bodyPos ? px(content.bodyPos.x, W) : CX,
      startY: bcy - ((blines.length - 1) * blh) / 2,
      fontSize: bfs, lineHeight: blh,
      fill: BODY_FG, fontFamily: bodyFontFamily, fontWeight: '400',
    }));
  }

  // Accent
  if (accent) {
    const alines = wrapText(accent, 22);
    const acy = content.accentPos ? px(content.accentPos.y, H) : 1340;
    textParts.push(svgText({
      lines: alines,
      x: content.accentPos ? px(content.accentPos.x, W) : CX,
      startY: acy - ((alines.length - 1) * 84) / 2,
      fontSize: 68, lineHeight: 84, fill: ACCENT,
      fontFamily: FONT_FAMILIES.default, fontWeight: '700',
    }));
  }

  // CDATA wrapper keeps the & chars inside the URL valid XML — required by
  // Sharp's librsvg parser. Browsers handle CDATA in <style> correctly too.
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style><![CDATA[@import url('${GOOGLE_FONTS_URL}');]]></style>
    <radialGradient id="vg" cx="50%" cy="0%" r="70%" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#1a2744" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="600" fill="url(#vg)"/>
  ${imageParts.join('\n  ')}
  ${textParts.join('\n  ')}
</svg>`;
}
