/**
 * lib/stability/render-remotion.ts  — SERVER ONLY
 *
 * Renders an animated slide video using Remotion.
 * Produces a 1080×1920 H.264 mp4 with spring-physics entrance animations.
 *
 * The Remotion bundle is cached across calls within the same process so only
 * the first render of a job pays the ~5-10 s webpack bundling cost.
 */

import { bundle }                     from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs   from 'fs';
import type { SlideContent }          from './slide-svg';

// Remotion ships its own Chrome Headless Shell and downloads it automatically
// the first time renderMedia() is called. No manual browser path needed unless
// you want to override with CHROME_PATH.

// ─── Bundle cache ────────────────────────────────────────────────────────────

let _bundlePromise: Promise<string> | null = null;

async function getBundle(): Promise<string> {
  if (_bundlePromise) return _bundlePromise;

  _bundlePromise = bundle({
    entryPoint: path.resolve(process.cwd(), 'remotion/index.ts'),
    // Pass through the project tsconfig so Remotion resolves TS paths correctly
    webpackOverride: (config) => config,
  });

  return _bundlePromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render one animated slide to an H.264 mp4.
 *
 * @param content         Slide text + layout data (same as buildSlideSvg)
 * @param durationSeconds Exact duration of the scene (from TTS audio length)
 * @param outputPath      Absolute path for the output .mp4
 */
export async function renderSlideVideo(
  content: SlideContent,
  durationSeconds: number,
  outputPath: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const fps              = 30;
  const durationInFrames = Math.max(30, Math.round(durationSeconds * fps));

  // 1. Bundle (cached in-process)
  const serveUrl = await getBundle();

  // 2. Select composition and override duration for this slide
  const composition = await selectComposition({
    serveUrl,
    id: 'SlideComposition',
    inputProps: { content },
    timeoutInMilliseconds: 30_000,
  });

  composition.durationInFrames = durationInFrames;

  // 3. Render — Remotion auto-downloads its Chrome Headless Shell on first call
  await renderMedia({
    composition,
    serveUrl,
    codec:          'h264',
    outputLocation: outputPath,
    inputProps:     { content },
    ...(process.env.CHROME_PATH ? { browserExecutable: process.env.CHROME_PATH } : {}),
    concurrency:    4,
    timeoutInMilliseconds: 120_000,
    onProgress: () => undefined,
  });
}
