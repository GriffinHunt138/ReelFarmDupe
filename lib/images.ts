import { chromium } from 'playwright';
import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.cwd(), 'assets', 'images');
fs.mkdirSync(CACHE_DIR, { recursive: true });

export interface ImageResult {
  id: string;
  url: string;        // 736x Pinterest URL for download
  previewUrl: string; // 474x thumbnail for UI
}

function imageCachePath(query: string, index: number): string {
  const hash = crypto.createHash('md5').update(`${query}-${index}`).digest('hex').slice(0, 10);
  return path.join(CACHE_DIR, `${hash}.png`);
}

// Promise cache — parallel calls with same query share one scrape.
// Empty results are NOT cached so a bad scrape can be retried.
const scrapeCache = new Map<string, Promise<ImageResult[]>>();

function getPinterestResults(query: string): Promise<ImageResult[]> {
  const raw = query.trim();
  const ugcQuery = raw.toLowerCase().startsWith('ugc ') ? raw : `ugc ${raw}`;
  const key = ugcQuery.toLowerCase();
  if (scrapeCache.has(key)) return scrapeCache.get(key)!;

  const promise = runPinterestScrape(ugcQuery).then(results => {
    if (results.length === 0) scrapeCache.delete(key); // allow retry on empty
    return results;
  });

  scrapeCache.set(key, promise);
  return promise;
}

async function runPinterestScrape(query: string, count = 24): Promise<ImageResult[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    const searchUrl =
      `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Log where we actually landed — helps debug redirects
    console.log(`[pinterest] navigated to: ${page.url()}`);

    // Wait until at least 8 pin images are in the DOM.
    // This ensures actual search results have rendered, not just the page shell.
    await page
      .waitForFunction(
        () => document.querySelectorAll('img[src*="pinimg.com"]').length >= 8,
        { timeout: 20000 },
      )
      .catch(() => {
        console.warn('[pinterest] timed out waiting for 8 images — collecting whatever is there');
      });

    // Helper: grab all pinimg.com srcs currently in the DOM
    async function collectFromDom(): Promise<string[]> {
      return page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="pinimg.com"]'))
          .map(img => img.src)
          .filter(src => {
            if (!src) return false;
            // Skip avatar / icon sizes
            if (/\/(30x|75x|60x|45x|170x)\//.test(src)) return false;
            return true;
          }),
      );
    }

    const allSrcs = new Set<string>();
    for (const s of await collectFromDom()) allSrcs.add(s);

    // Scroll down in steps, collecting new images each time
    for (let step = 1; step <= 5; step++) {
      await page.evaluate((y: number) => window.scrollTo(0, y), step * 1000);
      await page.waitForTimeout(900);
      for (const s of await collectFromDom()) allSrcs.add(s);
    }

    // Deduplicate by base path (ignore size segment) and build results
    const seenBase = new Set<string>();
    const results: ImageResult[] = [];

    for (const src of allSrcs) {
      const base = src.replace(/\/\d+x\d*\//, '/SIZE/').split('?')[0];
      if (seenBase.has(base)) continue;
      seenBase.add(base);

      results.push({
        id: String(results.length),
        // 736x is reliably accessible and high enough quality for 1080p slides
        url:        src.replace(/\/\d+x\d*\//, '/736x/'),
        previewUrl: src.replace(/\/\d+x\d*\//, '/474x/'),
      });

      if (results.length >= count) break;
    }

    console.log(`[pinterest] "${query}" → ${results.length} results`);
    return results;
  } finally {
    await browser.close();
  }
}

export async function fetchAndCropImage(query: string, index = 0): Promise<string> {
  const cachePath = imageCachePath(query, index);
  if (fs.existsSync(cachePath)) return cachePath;

  const results = await getPinterestResults(query);
  if (!results.length) throw new Error(`No Pinterest results for: ${query}`);

  const photo = results[index % results.length];

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.pinterest.com/',
  };

  let buffer: Buffer;
  try {
    const res = await axios.get<ArrayBuffer>(photo.url, {
      responseType: 'arraybuffer', headers, timeout: 15000,
    });
    buffer = Buffer.from(res.data);
  } catch {
    // 736x failed — fall back to 474x
    const fallback = photo.url.replace('/736x/', '/474x/');
    const res = await axios.get<ArrayBuffer>(fallback, {
      responseType: 'arraybuffer', headers, timeout: 15000,
    });
    buffer = Buffer.from(res.data);
  }

  await sharp(buffer)
    .resize(1080, 1920, { fit: 'cover', position: 'entropy' })
    .png({ quality: 90 })
    .toFile(cachePath);

  return cachePath;
}

export async function searchImages(query: string, count = 6): Promise<ImageResult[]> {
  const results = await getPinterestResults(query);
  return results.slice(0, count);
}

export async function cropImageFromUrl(url: string): Promise<string> {
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 10);
  const cachePath = path.join(CACHE_DIR, `custom-${hash}.png`);
  if (fs.existsSync(cachePath)) return cachePath;

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.pinterest.com/',
  };

  let buffer: Buffer;
  try {
    const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', headers, timeout: 15000 });
    buffer = Buffer.from(res.data);
  } catch {
    const fallback = url.replace(/\/\d+x\d*\//, '/474x/');
    const res = await axios.get<ArrayBuffer>(fallback, { responseType: 'arraybuffer', headers, timeout: 15000 });
    buffer = Buffer.from(res.data);
  }

  await sharp(buffer)
    .resize(1080, 1920, { fit: 'cover', position: 'entropy' })
    .png({ quality: 90 })
    .toFile(cachePath);

  return cachePath;
}
