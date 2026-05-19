/**
 * Background queue worker — started once when the Next.js server boots.
 * Checks for due items every 5 minutes and posts them via Playwright.
 */

import { getDueItems, updateQueueItem } from './queue';
import { postToTikTok, checkChromeConnected } from './tiktok-poster';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';

const CHROME_PROFILE = `${os.homedir()}/.reelfarm-chrome-profile`;
const CHROME_BIN     = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function ensureChromeRunning(): Promise<void> {
  if (await checkChromeConnected()) return;

  console.log('[queue-worker] Chrome not connected — launching automatically…');
  const cmd = `"${CHROME_BIN}" --remote-debugging-port=9222 --user-data-dir="${CHROME_PROFILE}" --no-first-run --no-default-browser-check --headless=new`;
  await new Promise<void>((resolve) => {
    exec(cmd, (err) => { if (err) console.error('[queue-worker] Chrome launch error:', err.message); });
    // Give it 5 seconds to bind the port
    setTimeout(resolve, 5000);
  });

  if (!await checkChromeConnected()) {
    throw new Error('Chrome failed to start with remote debugging. Open ReelFarm → Queue tab and click "Launch Chrome".');
  }
  console.log('[queue-worker] Chrome auto-launched successfully');
}

let running = false;

export async function processQueue(): Promise<{ processed: number; errors: string[] }> {
  if (running) return { processed: 0, errors: ['Already processing'] };
  running = true;

  const errors: string[] = [];
  let processed = 0;

  try {
    const due = getDueItems();
    console.log(`[queue-worker] ${due.length} item(s) due`);
    if (due.length === 0) return { processed: 0, errors: [] };

    // Make sure Chrome is up before we start posting
    await ensureChromeRunning();

    for (const item of due) {
      updateQueueItem(item.id, { status: 'posting' });
      try {
        await postToTikTok(item);
        updateQueueItem(item.id, { status: 'posted', posted_at: new Date().toISOString() });
        processed++;

        // Clean up local files after successful post
        if (item.output_dir && fs.existsSync(item.output_dir)) {
          fs.rmSync(item.output_dir, { recursive: true, force: true });
          console.log(`[queue-worker] Deleted ${item.output_dir}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[queue-worker] Failed to post "${item.title}":`, msg);
        updateQueueItem(item.id, { status: 'failed', error_msg: msg });
        errors.push(`"${item.title}": ${msg}`);
      }
    }
  } finally {
    running = false;
  }

  return { processed, errors };
}

export function startQueueWorker() {
  console.log('[queue-worker] Started — checking every 5 minutes');
  // Kick off immediately, then every 5 minutes
  processQueue().catch(console.error);
  setInterval(() => processQueue().catch(console.error), 5 * 60 * 1000);
}
