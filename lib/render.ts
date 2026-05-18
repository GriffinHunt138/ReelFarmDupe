import { chromium } from 'playwright';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { buildSlideHtml, SlideHtmlData } from './buildSlideHtml';

export interface SlideData {
  headline: string;
  headlineHtml?: string;
  bodyHtml?: string;
  /** Pinterest image URL (736x). Will be fetched and embedded as base64. */
  imageUrl: string;
  overlay_style: string;
  template: string;
  hlX?: number;
  hlY?: number;
  bodyX?: number;
  bodyY?: number;
  hlStyle?: string;
  bodyStyle?: string;
  hlFont?: string;
  bodyFont?: string;
  hlFontSize?: number;
  hlWidth?: number;
  bodyFontSize?: number;
  bodyWidth?: number;
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://www.pinterest.com/',
};

/**
 * Download an image and return it as a base64 data URI.
 * We embed the raw bytes — no resizing — so CSS `background-size:cover;
 * background-position:center` in slide.html does the cropping, matching the
 * browser iframe preview exactly.
 */
async function toDataUri(url: string): Promise<string> {
  if (!url) return '';
  // If it's already a data URI (e.g. test fixtures), pass through.
  if (url.startsWith('data:')) return url;
  // If it's a local file path, read directly.
  if (fs.existsSync(url)) {
    const buf = fs.readFileSync(url);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer', headers: HEADERS, timeout: 15000,
    });
    const buf = Buffer.from(res.data);
    // Detect mime type from magic bytes
    const mime = buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg'
               : buf[0] === 0x89 ? 'image/png'
               : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    // Fall back to 474x version
    const fallback = url.replace(/\/\d+x\d*\//, '/474x/');
    try {
      const res = await axios.get<ArrayBuffer>(fallback, {
        responseType: 'arraybuffer', headers: HEADERS, timeout: 15000,
      });
      const buf = Buffer.from(res.data);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch {
      console.warn('[render] failed to fetch image:', url);
      return '';
    }
  }
}

export async function renderSlides(slides: SlideData[], postTitle: string): Promise<string[]> {
  const templatePath = path.join(process.cwd(), 'templates', 'slide.html');
  const template = fs.readFileSync(templatePath, 'utf-8');

  const safeTitle = postTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  const outputDir = path.join(process.cwd(), 'outputs', safeTitle);
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  const outputPaths: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];

    // Embed the image as base64 so Playwright doesn't need to fetch it.
    // We pass the raw bytes — CSS handles the cover/center crop identically
    // to how the browser renders the iframe preview.
    const imageDataUri = await toDataUri(slide.imageUrl);

    const data: SlideHtmlData = {
      overlayStyle:  slide.overlay_style ?? 'dark-cinematic',
      imageUrl:      imageDataUri,
      headlineHtml:  slide.headlineHtml ?? slide.headline,
      hlStyle:       slide.hlStyle,
      hlX:           slide.hlX,
      hlY:           slide.hlY,
      hlFont:        slide.hlFont,
      hlFontSize:    slide.hlFontSize,
      bodyHtml:      slide.bodyHtml,
      bodyStyle:     slide.bodyStyle,
      bodyX:         slide.bodyX,
      bodyY:         slide.bodyY,
      bodyFont:      slide.bodyFont,
      bodyFontSize:  slide.bodyFontSize,
      hlWidth:       slide.hlWidth,
      bodyWidth:     slide.bodyWidth,
    };

    const html = buildSlideHtml(template, data);

    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    // Wait for Google Fonts to finish loading
    await page.waitForTimeout(1000);

    const filePath = path.join(outputDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: filePath, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    await page.close();
    outputPaths.push(filePath);
  }

  await browser.close();
  return outputPaths;
}
