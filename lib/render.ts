import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

export interface SlideData {
  headline: string;
  headlineHtml?: string;
  bodyHtml?: string;
  image_url: string;
  overlay_style: string;
  slide_number: string;
  template: string;
  hlX?: number;
  hlY?: number;
  bodyX?: number;
  bodyY?: number;
  hlStyle?: string;
  bodyStyle?: string;
}

function headlineSizeClass(text: string): string {
  const plain = text.replace(/<[^>]*>/g, '');
  if (plain.length > 60) return 'very-long';
  if (plain.length > 35) return 'long';
  return '';
}

function buildSlideHtml(slide: SlideData): string {
  const templatePath = path.join(process.cwd(), 'templates', 'slide.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  let imageDataUrl = '';
  if (slide.image_url && fs.existsSync(slide.image_url)) {
    const buf = fs.readFileSync(slide.image_url);
    imageDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  }

  const hlHtml   = slide.headlineHtml ?? slide.headline;
  const bodyHtml = slide.bodyHtml ?? '';
  const hlStyle   = slide.hlStyle   ?? 'default';
  const bodyStyle = slide.bodyStyle ?? 'default';

  const bodyBlock = bodyHtml
    ? `<div class="text-block" style="left:${slide.bodyX ?? 50}%;top:${slide.bodyY ?? 68}%;"><div class="body-text"><span class="ts-${bodyStyle}">${bodyHtml}</span></div></div>`
    : '';

  html = html
    .replace(/\{\{TEMPLATE\}\}/g, slide.template)
    .replace(/\{\{IMAGE_URL\}\}/g, imageDataUrl)
    .replace(/\{\{OVERLAY_STYLE\}\}/g, slide.overlay_style)
    .replace(/\{\{SLIDE_NUMBER\}\}/g, slide.slide_number)
    .replace(/\{\{HL_HTML\}\}/g, `<span class="ts-${hlStyle}">${hlHtml}</span>`)
    .replace(/\{\{HEADLINE_SIZE_CLASS\}\}/g, headlineSizeClass(hlHtml))
    .replace(/\{\{HL_X_PCT\}\}/g, String(slide.hlX ?? 50))
    .replace(/\{\{HL_Y_PCT\}\}/g, String(slide.hlY ?? 45))
    .replace(/\{\{BODY_BLOCK\}\}/g, bodyBlock);

  return html;
}

export async function renderSlides(slides: SlideData[], postTitle: string): Promise<string[]> {
  const safeTitle = postTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  const outputDir = path.join(process.cwd(), 'outputs', safeTitle);
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const outputPaths: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const html = buildSlideHtml(slides[i]);
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const filePath = path.join(outputDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: filePath, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    await page.close();
    outputPaths.push(filePath);
  }

  await browser.close();
  return outputPaths;
}
