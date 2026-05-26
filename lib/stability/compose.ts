import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs   from 'fs';
import sharp from 'sharp';
import { buildRockSvg } from './rock-svg';
import type { RockMood } from './types';

const execFileAsync = promisify(execFile);
const FFMPEG  = process.env.FFMPEG_PATH  ?? '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH ?? '/opt/homebrew/bin/ffprobe';

// Rock is rendered at this width in the final video (1080px wide canvas)
const ROCK_W = 340;

/** Convert SVG string → PNG file via sharp. */
export async function renderRockPng(mood: RockMood, outputPath: string): Promise<void> {
  const svg = buildRockSvg(mood, ROCK_W);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

/**
 * Render two Rocky frames for talking animation:
 *   rockOpenPath  — mouth open  (the "talking" ellipse)
 *   rockClosedPath — mouth closed (idle smile, same brows/eyes as mood)
 */
export async function renderRockTalkingFrames(
  mood: RockMood,
  rockOpenPath: string,
  rockClosedPath: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(rockOpenPath), { recursive: true });
  await Promise.all([
    sharp(Buffer.from(buildRockSvg(mood, ROCK_W, true))).png().toFile(rockOpenPath),
    sharp(Buffer.from(buildRockSvg(mood, ROCK_W, false))).png().toFile(rockClosedPath),
  ]);
}

/**
 * Detect speech intervals in an audio file using FFmpeg silencedetect.
 * Returns an array of [start, end] pairs (in seconds) where speech occurs.
 * Silences shorter than 0.15 s are ignored so brief gaps don't close the mouth mid-word.
 */
async function detectSpeechIntervals(audioPath: string): Promise<Array<[number, number]>> {
  const totalDuration = await getAudioDurationLocal(audioPath);
  let output = '';
  try {
    const { stderr } = await execFileAsync(FFMPEG, [
      '-i', audioPath,
      '-af', 'silencedetect=noise=-35dB:d=0.15',
      '-f', 'null', '-',
    ], { timeout: 30_000 }) as { stdout: string; stderr: string };
    output = stderr ?? '';
  } catch (e: unknown) {
    // execFile rejects on non-zero exit (ffmpeg -f null always exits non-zero); capture stderr
    output = (e as { stderr?: string }).stderr ?? '';
  }

  // Parse silence_start / silence_end pairs
  const silences: Array<[number, number]> = [];
  const startMatches = [...output.matchAll(/silence_start:\s*([\d.]+)/g)];
  const endMatches   = [...output.matchAll(/silence_end:\s*([\d.]+)/g)];

  for (let i = 0; i < startMatches.length; i++) {
    const start = parseFloat(startMatches[i][1]);
    const end   = endMatches[i] ? parseFloat(endMatches[i][1]) : totalDuration;
    silences.push([start, end]);
  }

  // Invert: speech is everything NOT in silence
  const speech: Array<[number, number]> = [];
  let cursor = 0;
  for (const [sStart, sEnd] of silences) {
    if (sStart > cursor + 0.05) speech.push([cursor, sStart]);
    cursor = sEnd;
  }
  if (cursor < totalDuration - 0.05) speech.push([cursor, totalDuration]);

  return speech.length > 0 ? speech : [[0, totalDuration]]; // fallback: whole clip is speech
}

/** Get audio duration using ffprobe */
async function getAudioDurationLocal(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync(FFPROBE, [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', audioPath,
  ], { timeout: 15_000 }) as { stdout: string; stderr: string };
  return parseFloat(stdout.trim()) || 10;
}

/**
 * Build the FFmpeg `enable` expression string that is true only when:
 *   - we're in a speech interval (not silence), AND
 *   - we're in the "open" half of the mouth-flap cycle (mod(t, 0.25) < 0.125)
 */
function buildMouthEnableExpr(speechIntervals: Array<[number, number]>): string {
  if (speechIntervals.length === 0) return '0';
  // Each speech interval contributes: between(t, start, end)
  const speechExpr = speechIntervals
    .map(([s, e]) => `between(t,${s.toFixed(3)},${e.toFixed(3)})`)
    .join('+');
  // AND with the open-phase of the cycle (use * for AND)
  return `lt(mod(t\\,0.25)\\,0.125)*gt(${speechExpr}\\,0)`;
}

/** Escape text for FFmpeg drawtext filter string (not shell — used inside filter_complex arg). */
function escapeDrawtext(s: string): string {
  // In drawtext, within the filter_complex value: escape \, :, ', [, ]
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g,  "’")  // replace apostrophe with curly quote — no escaping needed
    .replace(/:/g,  '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Composite one SLIDE scene:
 *   slide PNG (fade in from black) + animated Rocky + audio → scene .mp4
 *
 * No background video — the slide is a still image that fades in over 0.3s.
 * Rocky's mouth alternates only during detected speech intervals.
 */
export async function composeSlideScene(opts: {
  slidePng:      string;
  rockOpenPng:   string;
  rockClosedPng: string;
  audioPath:     string;
  duration:      number;
  output:        string;
  /** Rocky center as 0–100% of canvas. Defaults to bottom-center (50%, 84%). */
  rockyX?: number;
  rockyY?: number;
}): Promise<void> {
  const { slidePng, rockOpenPng, rockClosedPng, audioPath, duration, output } = opts;
  const rockyXPct = opts.rockyX ?? 50;
  const rockyYPct = opts.rockyY ?? 84;

  fs.mkdirSync(path.dirname(output), { recursive: true });

  const rockH = Math.round(ROCK_W * 260 / 240);
  // Convert center % → top-left pixel, clamped to canvas
  const rockX = Math.max(0, Math.min(1080 - ROCK_W, Math.round((rockyXPct / 100) * 1080 - ROCK_W / 2)));
  const rockY = Math.max(0, Math.min(1920 - rockH,  Math.round((rockyYPct / 100) * 1920 - rockH  / 2)));
  const dur      = Math.max(1, Math.min(duration, 120));
  const fadeOut  = Math.max(0, dur - 0.25); // start fade-out 0.25s before end

  const speechIntervals = await detectSpeechIntervals(audioPath);
  const mouthExpr = buildMouthEnableExpr(speechIntervals);

  // [0:v] = slide PNG (looped as still), [1:v] = rock-closed, [2:v] = rock-open, [3:a] = audio
  const filterComplex = [
    // Scale slide to exact canvas size, fade in 0.3s, fade out 0.25s at end
    `[0:v]scale=1080:1920,`,
    `fade=t=in:st=0:d=0.3,`,
    `fade=t=out:st=${fadeOut.toFixed(3)}:d=0.25[bg]`,
    `;`,
    `[bg][1:v]overlay=${rockX}:${rockY}[with_closed]`,
    `;`,
    `[with_closed][2:v]overlay=${rockX}:${rockY}:enable='${mouthExpr}'[out]`,
  ].join('');

  await execFileAsync(FFMPEG, [
    '-y',
    '-loop', '1', '-i', slidePng,      // still image looped
    '-i', rockClosedPng,
    '-i', rockOpenPng,
    '-i', audioPath,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-map', '3:a',
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-c:a', 'aac', '-ar', '44100',
    '-shortest',
    output,
  ], { timeout: 60_000 });
}

/**
 * Composite one SLIDE scene where the background is an ANIMATED VIDEO
 * (produced by Remotion) rather than a static PNG.
 *
 * The Remotion video already has the correct duration, so we just
 * overlay Rocky and mux in the audio — no looping or manual -t needed.
 */
export async function composeSlideSceneFromVideo(opts: {
  slideVideo:    string;   // Remotion-rendered .mp4
  rockOpenPng:   string;
  rockClosedPng: string;
  audioPath:     string;
  duration:      number;
  output:        string;
  rockyX?: number;
  rockyY?: number;
}): Promise<void> {
  const { slideVideo, rockOpenPng, rockClosedPng, audioPath, duration, output } = opts;
  const rockyXPct = opts.rockyX ?? 50;
  const rockyYPct = opts.rockyY ?? 84;

  fs.mkdirSync(path.dirname(output), { recursive: true });

  const rockH = Math.round(ROCK_W * 260 / 240);
  const rockX = Math.max(0, Math.min(1080 - ROCK_W, Math.round((rockyXPct / 100) * 1080 - ROCK_W / 2)));
  const rockY = Math.max(0, Math.min(1920 - rockH,  Math.round((rockyYPct / 100) * 1920 - rockH  / 2)));
  const dur   = Math.max(1, Math.min(duration, 120));

  const speechIntervals = await detectSpeechIntervals(audioPath);
  const mouthExpr       = buildMouthEnableExpr(speechIntervals);

  // [0:v] = Remotion slide video, [1:v] = rock-closed, [2:v] = rock-open, [3:a] = audio
  const filterComplex = [
    `[0:v]scale=1080:1920[bg]`,
    `;`,
    `[bg][1:v]overlay=${rockX}:${rockY}[with_closed]`,
    `;`,
    `[with_closed][2:v]overlay=${rockX}:${rockY}:enable='${mouthExpr}'[out]`,
  ].join('');

  await execFileAsync(FFMPEG, [
    '-y',
    '-i', slideVideo,     // Remotion animated video (no -loop)
    '-i', rockClosedPng,
    '-i', rockOpenPng,
    '-i', audioPath,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-map', '3:a',
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-c:a', 'aac', '-ar', '44100',
    '-shortest',
    output,
  ], { timeout: 90_000 });
}

/**
 * Composite one scene:
 *   bg video (looped) + animated Rocky (mouth open/closed) + caption + audio → scene .mp4
 *
 * Rocky's mouth alternates open→closed at ~4 fps (0.25 s cycle) for a talking animation.
 * Uses execFile (args array) — no shell involved, no quoting issues.
 */
export async function composeScene(opts: {
  bgVideo:       string;
  rockOpenPng:   string;   // Rocky mouth-open frame
  rockClosedPng: string;   // Rocky mouth-closed frame
  audioPath:     string;
  caption:       string;
  duration:      number;
  output:        string;
}): Promise<void> {
  const { bgVideo, rockOpenPng, rockClosedPng, audioPath, caption, duration, output } = opts;

  fs.mkdirSync(path.dirname(output), { recursive: true });

  const rockH    = Math.round(ROCK_W * 260 / 240);
  const rockX    = Math.round((1080 - ROCK_W) / 2);
  const rockY    = 1920 - rockH - 120;
  const captionY = rockY + rockH + 20;
  const escaped  = escapeDrawtext(caption);
  const dur      = Math.max(1, Math.min(duration, 120));

  // Detect speech intervals so mouth only moves when Rocky is actually talking
  const speechIntervals = await detectSpeechIntervals(audioPath);
  const mouthExpr = buildMouthEnableExpr(speechIntervals);

  // [0:v] = bg video, [1:v] = rock-closed PNG, [2:v] = rock-open PNG, [3:a] = audio
  // Strategy: closed mouth always visible; open mouth overlaid only during speech cycles
  const filterComplex = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,`,
    `crop=1080:1920,eq=brightness=-0.12[bg]`,
    `;`,
    `[bg][1:v]overlay=${rockX}:${rockY}[with_closed]`,
    `;`,
    `[with_closed][2:v]overlay=${rockX}:${rockY}:enable='${mouthExpr}'[rocked]`,
    `;`,
    `[rocked]drawtext=`,
    `text='${escaped}':`,
    `fontsize=38:fontcolor=white:`,
    `x=(w-text_w)/2:y=${captionY}:`,
    `box=1:boxcolor=black@0.70:boxborderw=14`,
    `[out]`,
  ].join('');

  await execFileAsync(FFMPEG, [
    '-y',
    '-stream_loop', '-1', '-i', bgVideo,
    '-i', rockClosedPng,
    '-i', rockOpenPng,
    '-i', audioPath,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-map', '3:a',
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-c:a', 'aac', '-ar', '44100',
    '-shortest',
    output,
  ], { timeout: 120_000 });
}

/**
 * Concatenate scene .mp4 files into a single final video.
 */
export async function concatenateScenes(scenePaths: string[], output: string): Promise<void> {
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const concatFile = output.replace('.mp4', '_concat.txt');
  fs.writeFileSync(concatFile, scenePaths.map(p => `file '${p}'`).join('\n'));

  await execFileAsync(FFMPEG, [
    '-y',
    '-f', 'concat', '-safe', '0',
    '-i', concatFile,
    '-c', 'copy',
    output,
  ], { timeout: 300_000 });

  fs.unlinkSync(concatFile);
}
