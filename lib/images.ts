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
  previewUrl: string; // smaller thumbnail for UI
}

function imageCachePath(query: string, index: number): string {
  const hash = crypto.createHash('md5').update(`${query}-${index}`).digest('hex').slice(0, 10);
  return path.join(CACHE_DIR, `${hash}.png`);
}

// Promise cache — parallel calls with same query share one scrape
const scrapeCache = new Map<string, Promise<ImageResult[]>>();

function getPinterestResults(query: string): Promise<ImageResult[]> {
  // Always prepend "ugc" unless the caller already did
  const raw = query.trim();
  const ugcQuery = raw.toLowerCase().startsWith('ugc ') ? raw : `ugc ${raw}`;
  const key = ugcQuery.toLowerCase();
  if (scrapeCache.has(key)) return scrapeCache.get(key)!;
  const promise = runPinterestScrape(ugcQuery);
  scrapeCache.set(key, promise);
  return promise;
}

async function runPinterestScrape(query: string, count = 20): Promise<ImageResult[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    await page.goto(
      `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`,
      { waitUntil: 'domcontentloaded', timeout: 30000 },
    );

    // Wait for pin grid to populate
    await page.waitForSelector('img[src*="pinimg.com"]', { timeout: 20000 }).catch(() => {});

    // Scroll to trigger lazy-load for more images
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1500);

    const results: ImageResult[] = await page.evaluate((targetCount: number) => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="pinimg.com"]'));
      const seen = new Set<string>();
      const out: ImageResult[] = [];

      for (const img of imgs) {
        const src = img.src;
        if (!src) continue;

        // Skip known-small sizes (avatars, icons, tiny thumbs)
        if (/\/(30x|75x|60x|45x|170x)/.test(src)) continue;

        // Filter by actual rendered dimensions — skip images that loaded too small
        // naturalWidth reflects the true source pixel width
        if (img.naturalWidth > 0 && img.naturalWidth < 400) continue;
        if (img.naturalHeight > 0 && img.naturalHeight < 400) continue;

        // Deduplicate by path without size segment
        const baseKey = src.replace(/\/\d+x\d*\//, '/SIZE/');
        if (seen.has(baseKey)) continue;
        seen.add(baseKey);

        // originals/ for highest quality download; 474x for a crisp preview thumbnail
        const fullUrl    = src.replace(/\/\d+x\d*\//, '/originals/');
        const previewUrl = src.replace(/\/\d+x\d*\//, '/474x/');

        out.push({ id: String(out.length), url: fullUrl, previewUrl });
        if (out.length >= targetCount) break;
      }
      return out;
    }, count);

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

  // Try originals/ first; fall back to 736x if the CDN returns 403/404
  const fallbackUrl = photo.url.replace('/originals/', '/736x/');
  let buffer: Buffer;
  try {
    const res = await axios.get<ArrayBuffer>(photo.url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.pinterest.com/',
      },
      timeout: 15000,
    });
    buffer = Buffer.from(res.data);
  } catch {
    const res = await axios.get<ArrayBuffer>(fallbackUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.pinterest.com/',
      },
      timeout: 15000,
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
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.pinterest.com/',
  };
  let buffer: Buffer;
  try {
    const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', headers, timeout: 15000 });
    buffer = Buffer.from(res.data);
  } catch {
    const fallback = url.replace('/originals/', '/736x/');
    const res = await axios.get<ArrayBuffer>(fallback, { responseType: 'arraybuffer', headers, timeout: 15000 });
    buffer = Buffer.from(res.data);
  }

  await sharp(buffer)
    .resize(1080, 1920, { fit: 'cover', position: 'entropy' })
    .png({ quality: 90 })
    .toFile(cachePath);

  return cachePath;
}
