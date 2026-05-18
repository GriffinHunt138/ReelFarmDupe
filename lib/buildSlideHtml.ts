/**
 * buildSlideHtml — pure string function, no Node.js imports.
 * Works in both browser (PreviewEditor iframes) and server (Playwright render).
 *
 * The SAME function + SAME template = SAME visual output at any scale.
 */

const FONT_FAMILY_MAP: Record<string, string> = {
  bebas:      "'Bebas Neue', sans-serif",
  inter:      "'Inter', sans-serif",
  anton:      "'Anton', sans-serif",
  oswald:     "'Oswald', sans-serif",
  playfair:   "'Playfair Display', serif",
  montserrat: "'Montserrat', sans-serif",
};

function headlineSizeClass(html: string): string {
  const plain = html.replace(/<[^>]*>/g, '');
  if (plain.length > 60) return 'very-long';
  if (plain.length > 35) return 'long';
  return '';
}

export interface SlideHtmlData {
  overlayStyle: string;
  /** External URL for browser preview OR base64 data URI for Playwright export. */
  imageUrl: string;
  headlineHtml: string;
  hlStyle?: string;
  hlX?: number;
  hlY?: number;
  hlFont?: string;
  hlFontSize?: number;    // px override — bypasses the auto-size class
  bodyHtml?: string;
  bodyStyle?: string;
  bodyX?: number;
  bodyY?: number;
  bodyFont?: string;
  bodyFontSize?: number;  // px override for body text
  textBoxWidth?: number;  // px width for both text blocks (default 780)
}

export function buildSlideHtml(template: string, d: SlideHtmlData): string {
  const isOrganic      = d.overlayStyle === 'organic-raw';
  const defaultHlFont  = isOrganic ? 'montserrat' : 'bebas';
  const defaultBodyFont= isOrganic ? 'montserrat' : 'inter';
  const hlFontFamily   = FONT_FAMILY_MAP[d.hlFont   ?? defaultHlFont]   ?? FONT_FAMILY_MAP[defaultHlFont];
  const bodyFontFamily = FONT_FAMILY_MAP[d.bodyFont ?? defaultBodyFont] ?? FONT_FAMILY_MAP[defaultBodyFont];

  const hlStyle   = d.hlStyle   ?? 'default';
  const bodyStyle = d.bodyStyle ?? 'default';
  const bodyHtml  = d.bodyHtml  ?? '';

  // Inline style overrides — font-size wins over CSS class when set
  const hlInlineStyle =
    `font-family: ${hlFontFamily};` +
    (d.hlFontSize ? ` font-size: ${d.hlFontSize}px;` : '');

  const bodyInlineStyle =
    `font-family: ${bodyFontFamily};` +
    (d.bodyFontSize ? ` font-size: ${d.bodyFontSize}px;` : '');

  const widthStyle = d.textBoxWidth ? `width:${d.textBoxWidth}px;` : '';

  const bodyBlock = bodyHtml
    ? `<div class="text-block" style="left:${d.bodyX ?? 50}%;top:${d.bodyY ?? 68}%;${widthStyle}">` +
      `<div class="body-text" style="${bodyInlineStyle}">` +
      `<span class="ts-${bodyStyle}">${bodyHtml}</span></div></div>`
    : '';

  // When a custom font size is set, skip the auto-size class so it doesn't conflict
  const hlSizeClass = d.hlFontSize ? '' : headlineSizeClass(d.headlineHtml);

  return template
    .replace(/\{\{TEMPLATE\}\}/g,            d.overlayStyle)
    .replace(/\{\{IMAGE_URL\}\}/g,           d.imageUrl)
    .replace(/\{\{OVERLAY_STYLE\}\}/g,       d.overlayStyle)
    .replace(/\{\{HL_FONT_OVERRIDE\}\}/g,    hlInlineStyle)
    .replace(/\{\{HL_HTML\}\}/g,             `<span class="ts-${hlStyle}">${d.headlineHtml}</span>`)
    .replace(/\{\{HEADLINE_SIZE_CLASS\}\}/g,  hlSizeClass)
    .replace(/\{\{HL_X_PCT\}\}/g,            String(d.hlX ?? 50))
    .replace(/\{\{HL_Y_PCT\}\}/g,            String(d.hlY ?? 45))
    .replace(/\{\{HL_WIDTH_STYLE\}\}/g,      widthStyle)
    .replace(/\{\{BODY_BLOCK\}\}/g,          bodyBlock);
}
