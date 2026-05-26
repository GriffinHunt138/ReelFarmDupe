/**
 * TikTok Playwright Automation
 *
 * Connects to an existing Chrome instance running with --remote-debugging-port=9222.
 * Opens TikTok Creator Studio, uploads slides as a photo carousel,
 * fills caption, schedules the post.
 */

import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { QueueItem } from './queue';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CDP_URL        = 'http://localhost:9222';
const UPLOAD_URL     = 'https://www.tiktok.com/upload';  // regular upload page — supports photo carousels
const UPLOAD_TIMEOUT = 180_000;
const NAV_TIMEOUT    = 30_000;

// ── Check if Chrome debug port is reachable ────────────────────────────────
export async function checkChromeConnected(): Promise<boolean> {
  try {
    const r = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

// ── Screenshot helper ──────────────────────────────────────────────────────
async function snap(page: Page, label: string) {
  try {
    const p = path.join(os.tmpdir(), `faceless-debug-${label}-${Date.now()}.png`);
    await page.screenshot({ path: p, fullPage: false });
    console.log(`[tiktok-poster] screenshot: ${p}`);
  } catch { /* non-fatal */ }
}

// ── Main posting function ──────────────────────────────────────────────────
export async function postToTikTok(item: QueueItem): Promise<void> {
  if (!await checkChromeConnected()) {
    throw new Error('Chrome is not running with remote debugging. Open Faceless → Queue and click "Launch Chrome".');
  }

  const slidePaths = item.slide_paths.filter(p => fs.existsSync(p)).sort();
  if (slidePaths.length === 0) {
    throw new Error(`No slide files found at expected paths.`);
  }

  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx  = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();

  try {
    console.log(`[tiktok-poster] Posting "${item.title}" (${slidePaths.length} slides)`);

    // ── 1. Navigate to upload page ───────────────────────────────────────
    await page.goto(UPLOAD_URL, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(3000);
    await snap(page, '01-loaded');

    // Verify we're on the upload page and logged in
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('signup')) {
      throw new Error('Not logged into TikTok. Open the Faceless Chrome window and log in first.');
    }

    // ── 2. Switch to Photo mode ──────────────────────────────────────────
    // Try multiple strategies to find the photo tab
    let photoModeActivated = false;

    // Strategy A: look for a tab/button with "Photo" text (case-insensitive)
    try {
      const photoBtn = page.getByRole('tab', { name: /photo/i }).or(
        page.getByRole('button', { name: /^photo$/i })
      ).first();
      if (await photoBtn.isVisible({ timeout: 5000 })) {
        await photoBtn.click();
        await page.waitForTimeout(2000);
        photoModeActivated = true;
        console.log('[tiktok-poster] Clicked photo tab (role)');
      }
    } catch { /* try next */ }

    // Strategy B: find by text content
    if (!photoModeActivated) {
      try {
        const photoEl = page.locator('text=/^Photo$/i, [data-e2e*="photo"], [class*="photoTab"]').first();
        if (await photoEl.isVisible({ timeout: 3000 })) {
          await photoEl.click();
          await page.waitForTimeout(2000);
          photoModeActivated = true;
          console.log('[tiktok-poster] Clicked photo tab (text)');
        }
      } catch { /* try next */ }
    }

    // Strategy C: look for it inside the upload type switcher
    if (!photoModeActivated) {
      try {
        await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('*'));
          const photoEl = els.find(el =>
            el.textContent?.trim().toLowerCase() === 'photo' &&
            (el.tagName === 'BUTTON' || el.getAttribute('role') === 'tab' || el.tagName === 'LI')
          ) as HTMLElement | undefined;
          if (photoEl) photoEl.click();
        });
        await page.waitForTimeout(2000);
        photoModeActivated = true;
        console.log('[tiktok-poster] Clicked photo tab (evaluate)');
      } catch { /* continue without photo mode */ }
    }

    await snap(page, '02-after-photo-tab');

    // ── 3. Upload files ──────────────────────────────────────────────────
    // Use file chooser interception — more reliable than directly targeting hidden input
    let uploaded = false;

    // Strategy A: intercept file chooser triggered by clicking the upload area
    try {
      const uploadAreaSelectors = [
        '[class*="uploadArea"]',
        '[class*="upload-area"]',
        '[data-e2e="upload-icon"]',
        'text=/select.*file|drag.*drop|click.*upload/i',
        '[class*="DragUpload"]',
        '[class*="dragupload"]',
      ];

      for (const sel of uploadAreaSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 1500 })) {
            const [chooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 5000 }),
              el.click(),
            ]);
            await chooser.setFiles(slidePaths);
            uploaded = true;
            console.log(`[tiktok-poster] Uploaded via file chooser (${sel})`);
            break;
          }
        } catch { /* try next */ }
      }
    } catch { /* fall through */ }

    // Strategy B: directly set input[type=file] with multiple forced
    if (!uploaded) {
      try {
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.waitFor({ state: 'attached', timeout: 8000 });
        await fileInput.evaluate((el: HTMLInputElement) => {
          el.multiple = true;
          el.removeAttribute('accept');
        });
        await fileInput.setInputFiles(slidePaths);
        uploaded = true;
        console.log('[tiktok-poster] Uploaded via direct input');
      } catch (e) {
        throw new Error(`Could not upload files: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Wait for upload to process
    console.log('[tiktok-poster] Waiting for upload to process…');
    await page.waitForTimeout(4000);

    // Wait for any progress/loading indicators to disappear
    try {
      await page.waitForFunction(
        () => !document.querySelector('[class*="progress" i], [class*="uploading" i], [class*="loading" i]'),
        { timeout: UPLOAD_TIMEOUT }
      );
    } catch { await page.waitForTimeout(8000); }

    await snap(page, '03-after-upload');

    // ── 4. Fill caption ──────────────────────────────────────────────────
    if (item.caption) {
      try {
        const captionSelectors = [
          '[data-e2e="caption-input"]',
          '.public-DraftEditor-content',
          '[contenteditable="true"]',
          'div[class*="caption" i][contenteditable]',
        ];
        let captionFilled = false;
        for (const sel of captionSelectors) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 3000 })) {
              await el.click();
              await page.waitForTimeout(300);
              await el.fill('');
              await el.pressSequentially(item.caption, { delay: 10 });
              captionFilled = true;
              console.log(`[tiktok-poster] Caption filled (${sel})`);
              break;
            }
          } catch { /* try next */ }
        }
        if (!captionFilled) console.warn('[tiktok-poster] Could not fill caption');
      } catch (e) {
        await snap(page, '04-caption-fail');
        console.warn('[tiktok-poster] Caption error:', e);
      }
    }

    // ── 5. Enable scheduling ─────────────────────────────────────────────
    await page.waitForTimeout(1000);
    try {
      const scheduleSelectors = [
        '[data-e2e="schedule-switch"]',
        'input[type="checkbox"]:near(:text("Schedule"))',
        'input[type="checkbox"]:near(:text("schedule"))',
      ];
      for (const sel of scheduleSelectors) {
        try {
          const toggle = page.locator(sel).first();
          if (await toggle.isVisible({ timeout: 3000 })) {
            const checked = await toggle.isChecked().catch(() => false);
            if (!checked) await toggle.click();
            await page.waitForTimeout(1500);
            console.log('[tiktok-poster] Schedule toggle enabled');
            break;
          }
        } catch { /* try next */ }
      }
    } catch {
      await snap(page, '05-schedule-fail');
      throw new Error('Could not find schedule toggle — TikTok UI may have changed. Check debug screenshot.');
    }

    // ── 6. Set date + time ───────────────────────────────────────────────
    const scheduledDate = new Date(item.scheduled_at);
    const yyyy = scheduledDate.getFullYear();
    const mm   = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const dd   = String(scheduledDate.getDate()).padStart(2, '0');
    const hh   = String(scheduledDate.getHours()).padStart(2, '0');
    const min  = String(scheduledDate.getMinutes()).padStart(2, '0');

    try {
      const dateInput = page.locator('input[type="date"], [data-e2e="schedule-date-picker"] input').first();
      if (await dateInput.isVisible({ timeout: 3000 })) {
        await dateInput.fill(`${yyyy}-${mm}-${dd}`);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400);
      }
    } catch { /* custom date picker */ }

    try {
      const timeInput = page.locator('input[type="time"], [data-e2e="schedule-time-picker"] input').first();
      if (await timeInput.isVisible({ timeout: 3000 })) {
        await timeInput.fill(`${hh}:${min}`);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400);
      }
    } catch { /* custom time picker */ }

    // ── 7. Submit ────────────────────────────────────────────────────────
    await snap(page, '06-pre-submit');

    // Be very specific about the submit button — avoid nav links
    const submitSelectors = [
      '[data-e2e="post-btn"]',
      '[data-e2e="schedule-post-btn"]',
      'button[class*="submit" i]:has-text("Post")',
      'button[class*="submit" i]:has-text("Schedule")',
      'footer button:has-text("Post")',
      'footer button:has-text("Schedule")',
      'form button[type="submit"]',
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).last();
        if (await btn.isVisible({ timeout: 2000 })) {
          const urlBefore = page.url();
          await btn.click();
          await page.waitForTimeout(2000);
          // If URL changed away from upload, likely succeeded
          if (!page.url().includes(urlBefore.split('?')[0])) {
            submitted = true;
          } else {
            submitted = true; // clicked something, check success below
          }
          console.log(`[tiktok-poster] Submit clicked (${sel})`);
          break;
        }
      } catch { /* try next */ }
    }

    if (!submitted) {
      await snap(page, '07-no-submit-btn');
      throw new Error('Could not find submit button. Check debug screenshot.');
    }

    // ── 8. Verify success ────────────────────────────────────────────────
    try {
      await page.waitForSelector(
        '[data-e2e="post-success"], [class*="SuccessModal" i], :text("Posted successfully"), :text("Scheduled successfully")',
        { timeout: 30000 }
      );
      console.log(`[tiktok-poster] ✓ Success indicator found`);
    } catch {
      await page.waitForTimeout(5000);
      const finalUrl = page.url();
      await snap(page, '08-post-submit');
      // Still on upload page = definite failure
      if (finalUrl.includes('/upload') || finalUrl.includes('creator-center/upload')) {
        throw new Error(`Post failed — still on upload page after submit. Check screenshot faceless-debug-08-post-submit.`);
      }
      // Navigated away — probably success
      console.log(`[tiktok-poster] Navigated to ${finalUrl} — assuming success`);
    }

    console.log(`[tiktok-poster] ✓ Posted "${item.title}"`);

  } catch (err) {
    await snap(page, 'error');
    throw err;
  } finally {
    await page.close();
  }
}
