/**
 * TikTok Playwright Automation
 *
 * Connects to an existing Chrome instance running with --remote-debugging-port=9222.
 * Opens TikTok Creator Studio in a new tab, uploads slides as a photo carousel,
 * fills in the caption + hashtags, and schedules the post.
 *
 * NOTE: TikTok's web UI changes frequently. If automation breaks, check the
 * selector constants below and update them to match the current TikTok UI.
 * Screenshots are saved to /tmp/reelfarm-debug-*.png on failure.
 */

import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { QueueItem } from './queue';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CDP_URL          = 'http://localhost:9222';
const UPLOAD_URL       = 'https://www.tiktok.com/creator-center/upload?from=studio';
const UPLOAD_TIMEOUT   = 180_000; // 3 min — large files can be slow
const NAV_TIMEOUT      = 30_000;

// ── Selector constants — update these if TikTok changes their UI ──────────
const SEL = {
  photoTab:        '[data-e2e="upload-type-photo"], [class*="photo"], button:has-text("Photo")',
  fileInput:       'input[type="file"]',
  caption:         '[data-e2e="caption-input"], [contenteditable="true"][data-e2e], .public-DraftEditor-content',
  scheduleSwitch:  '[data-e2e="schedule-switch"], input[type="checkbox"]:near(:text("Schedule"))',
  dateInput:       'input[type="date"], [data-e2e="schedule-date-picker"] input',
  timeInput:       'input[type="time"], [data-e2e="schedule-time-picker"] input',
  postBtn:         '[data-e2e="post-btn"], button:has-text("Schedule"), button:has-text("Post")',
  successIndicator:'[data-e2e="post-success"], [class*="SuccessModal"], :text("Posted")',
  progressBar:     '[class*="progress"], [class*="Progress"]',
};

// ── Check if Chrome debug port is reachable ────────────────────────────────
export async function checkChromeConnected(): Promise<boolean> {
  try {
    const r = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

// ── Screenshot helper for debugging failures ───────────────────────────────
async function saveDebugScreenshot(page: Page, label: string) {
  try {
    const p = path.join(os.tmpdir(), `reelfarm-debug-${label}-${Date.now()}.png`);
    await page.screenshot({ path: p });
    console.error(`[tiktok-poster] debug screenshot saved: ${p}`);
  } catch { /* non-fatal */ }
}

// ── Main posting function ──────────────────────────────────────────────────
export async function postToTikTok(item: QueueItem): Promise<void> {
  const isConnected = await checkChromeConnected();
  if (!isConnected) {
    throw new Error(
      'Chrome is not running with remote debugging. ' +
      'Click "Launch Chrome" in the Queue settings and make sure you are logged into TikTok.'
    );
  }

  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx     = browser.contexts()[0] ?? await browser.newContext();
  const page    = await ctx.newPage();

  try {
    console.log(`[tiktok-poster] Posting "${item.title}" scheduled for ${item.scheduled_at}`);

    // ── 1. Navigate ─────────────────────────────────────────────────────
    await page.goto(UPLOAD_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2000);

    // ── 2. Switch to Photo mode if the tab exists ────────────────────────
    try {
      const photoTab = page.locator(SEL.photoTab).first();
      if (await photoTab.isVisible({ timeout: 4000 })) {
        await photoTab.click();
        await page.waitForTimeout(1500);
      }
    } catch { /* video-only account — continue */ }

    // ── 3. Upload slide files ────────────────────────────────────────────
    const slidePaths = item.slide_paths
      .filter(p => fs.existsSync(p))
      .sort(); // slide-01.png, slide-02.png …

    if (slidePaths.length === 0) {
      throw new Error(`No slide files found. Expected paths: ${item.slide_paths.join(', ')}`);
    }

    const fileInput = page.locator(SEL.fileInput).first();
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });
    await fileInput.setInputFiles(slidePaths);
    console.log(`[tiktok-poster] Uploading ${slidePaths.length} slides`);

    // Wait for upload progress to clear
    await page.waitForTimeout(3000);
    try {
      await page.waitForFunction(
        (sel) => !document.querySelector(sel),
        SEL.progressBar,
        { timeout: UPLOAD_TIMEOUT }
      );
    } catch {
      // Progress indicator may not exist or may use different selector — continue
      await page.waitForTimeout(5000);
    }

    // ── 4. Fill caption ──────────────────────────────────────────────────
    if (item.caption) {
      try {
        const captionEl = page.locator(SEL.caption).first();
        await captionEl.waitFor({ state: 'visible', timeout: 10000 });
        await captionEl.click();
        await page.waitForTimeout(300);

        // caption already contains the hashtags (e.g. "#fitness #health")
        const full = item.caption ?? '';

        // Use keyboard to type so TikTok's editor registers the input
        await captionEl.fill('');
        await captionEl.pressSequentially(full, { delay: 8 });
        await page.waitForTimeout(500);
      } catch (e) {
        console.warn('[tiktok-poster] Could not fill caption:', e);
        await saveDebugScreenshot(page, 'caption');
      }
    }

    // ── 5. Enable scheduling ─────────────────────────────────────────────
    try {
      const toggle = page.locator(SEL.scheduleSwitch).first();
      if (await toggle.isVisible({ timeout: 5000 })) {
        const isChecked = await toggle.isChecked().catch(() => false);
        if (!isChecked) await toggle.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      await saveDebugScreenshot(page, 'schedule-toggle');
      throw new Error('Could not find schedule toggle — TikTok UI may have changed.');
    }

    // ── 6. Set date + time ───────────────────────────────────────────────
    const scheduledDate = new Date(item.scheduled_at);

    try {
      const dateInput = page.locator(SEL.dateInput).first();
      if (await dateInput.isVisible({ timeout: 3000 })) {
        const ymd = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
        await dateInput.fill(ymd);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);
      }
    } catch { /* date picker may be a custom component */ }

    try {
      const timeInput = page.locator(SEL.timeInput).first();
      if (await timeInput.isVisible({ timeout: 3000 })) {
        const hh = String(scheduledDate.getHours()).padStart(2, '0');
        const mm = String(scheduledDate.getMinutes()).padStart(2, '0');
        await timeInput.fill(`${hh}:${mm}`);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);
      }
    } catch { /* time picker may differ */ }

    // ── 7. Submit ────────────────────────────────────────────────────────
    await saveDebugScreenshot(page, 'pre-submit'); // always save pre-submit for review

    const postBtn = page.locator(SEL.postBtn).last();
    await postBtn.waitFor({ state: 'visible', timeout: 15000 });
    await postBtn.click();

    // Wait for success (best-effort — TikTok may redirect or show a modal)
    try {
      await page.waitForSelector(SEL.successIndicator, { timeout: 30000 });
    } catch {
      // Some TikTok versions just redirect on success — give it a moment
      await page.waitForTimeout(5000);
      if (page.url().includes('/upload')) {
        await saveDebugScreenshot(page, 'post-submit');
        throw new Error('Post may have failed — still on upload page after submit. Check the debug screenshot.');
      }
    }

    console.log(`[tiktok-poster] ✓ Posted "${item.title}"`);
  } catch (err) {
    await saveDebugScreenshot(page, 'error');
    throw err;
  } finally {
    await page.close();
    // Don't close the browser — it's the user's Chrome session
  }
}
