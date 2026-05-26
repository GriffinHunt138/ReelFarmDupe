/**
 * slide.ts  — SERVER ONLY (imports sharp)
 *
 * Renders a 1080×1920 slide PNG.
 * The SVG is built by slide-svg.ts (shared client+server); this file just
 * runs it through Sharp to produce a PNG file.
 */

import fs   from 'fs';
import path from 'path';
import sharp from 'sharp';
import { buildSlideSvg } from './slide-svg';

// Re-export SlideContent so existing callers (route.ts) don't break.
export type { SlideContent } from './slide-svg';

/** Render a SlideContent to a PNG file. */
export async function renderSlide(
  content: Parameters<typeof buildSlideSvg>[0],
  outputPath: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const svg = buildSlideSvg(content);
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}
