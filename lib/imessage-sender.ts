/**
 * Delivers slideshow slides by:
 *   1. Copying PNGs into ~/iCloud Drive/ReelFarm/<title>/  (syncs to iPhone automatically)
 *   2. Sending ONE short iMessage text so you know they're ready
 *
 * This avoids sending large files through iMessage (which corrupts the
 * Messages upload queue on macOS). You'll get a ping on your phone, open
 * Files → ReelFarm → save to Camera Roll → post to TikTok.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { QueueItem } from './queue';

const execFileAsync = promisify(execFile);

const ICLOUD_ROOT = path.join(
  process.env.HOME ?? '/Users/griffinhunt',
  'Library/Mobile Documents/com~apple~CloudDocs'
);
const REELFARM_DIR = path.join(ICLOUD_ROOT, 'ReelFarm');

async function sendTextViaiMessage(phone: string, message: string): Promise<void> {
  const escaped = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `
tell application "Messages"
  set targetService to first service whose service type is iMessage
  set targetBuddy to buddy "${phone}" of targetService
  send "${escaped}" to targetBuddy
end tell
`;
  const tmp = `/tmp/reelfarm-as-${Date.now()}.applescript`;
  fs.writeFileSync(tmp, script);
  try {
    await execFileAsync('osascript', [tmp]);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

export async function sendSlideshowViaiMessage(item: QueueItem, phone: string): Promise<void> {
  const slidePaths = item.slide_paths.filter(p => fs.existsSync(p)).sort();

  if (slidePaths.length === 0) {
    throw new Error(`No slide files found. Expected: ${item.slide_paths.join(', ')}`);
  }

  // ── 1. Copy slides into iCloud Drive/ReelFarm/<slug>/ ──────────────────────
  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const destDir = path.join(REELFARM_DIR, slug);
  fs.mkdirSync(destDir, { recursive: true });

  for (const src of slidePaths) {
    const dest = path.join(destDir, path.basename(src));
    fs.copyFileSync(src, dest);
  }
  console.log(`[imessage] Copied ${slidePaths.length} slides → iCloud Drive/ReelFarm/${slug}/`);

  console.log(`[imessage] ✓ Slides ready in iCloud Drive/ReelFarm/${slug}/`);
}
