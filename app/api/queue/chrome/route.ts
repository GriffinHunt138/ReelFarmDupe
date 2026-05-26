import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { checkChromeConnected } from '@/lib/tiktok-poster';

export async function GET() {
  const connected = await checkChromeConnected();
  return NextResponse.json({ connected });
}

export async function POST() {
  // Already connected?
  if (await checkChromeConnected()) {
    return NextResponse.json({ ok: true, message: 'Chrome already connected' });
  }

  // Launch Chrome with a dedicated user-data-dir so it runs as a fully separate
  // process (bypasses Chrome's singleton lock) with remote debugging enabled.
  const profileDir = `${process.env.HOME}/.faceless-chrome-profile`;
  const cmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check &`;
  exec(cmd, (err) => {
    if (err) console.error('[chrome-launch]', err.message);
  });

  // Give Chrome 3 seconds to start then confirm
  await new Promise(r => setTimeout(r, 3000));
  const connected = await checkChromeConnected();
  return NextResponse.json({
    ok: connected,
    message: connected
      ? 'Chrome launched with debug port. Make sure you are logged into TikTok.'
      : 'Chrome launched — it may take a few seconds. Click "Check Status" to confirm.',
  });
}
