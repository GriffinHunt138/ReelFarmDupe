import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { stabilityJobs } from '@/lib/db';
import { textToSpeech, getAudioDuration } from '@/lib/stability/elevenlabs';
import { renderRockTalkingFrames, composeSlideSceneFromVideo, concatenateScenes } from '@/lib/stability/compose';
import { renderSlideVideo } from '@/lib/stability/render-remotion';
import type { SlideContent } from '@/lib/stability/slide';
import type { StabilityScript, StabilityScene } from '@/lib/stability/types';
import type { RockMood } from '@/lib/stability/types';

function uid() { return Math.random().toString(36).slice(2, 10); }
function jobDir(jobId: string) {
  return path.join(process.cwd(), 'outputs', 'stability', jobId);
}

// ─── Narration generation from user-defined slides ─────────────────────────

async function generateNarrationsFromSlides(
  slides: SlideContent[],
  targetTotalSeconds = 45,
): Promise<Array<{ text: string; mood: RockMood; duration: number }>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // At ~140 wpm TTS, 45 seconds ≈ 105 words total
  const totalWords    = Math.round(targetTotalSeconds * 140 / 60);
  const wordsPerSlide = Math.max(10, Math.round(totalWords / slides.length));
  const secsPerSlide  = Math.round(targetTotalSeconds / slides.length);

  const slideSummaries = slides.map((s, i) => {
    const parts = [`Slide ${i + 1}:`];
    if (s.chip)     parts.push(`  Label: "${s.chip}"`);
    if (s.headline) parts.push(`  Headline: "${s.headline}"`);
    if (s.body)     parts.push(`  Body: "${s.body}"`);
    if (s.accent)   parts.push(`  Accent: "${s.accent}"`);
    return parts.join('\n');
  }).join('\n\n');

  const prompt = `You are Rocky — a comically aggressive, unhinged rock mascot on TikTok. Rocky is a boulder with a face who is DEEPLY personally offended by bad posture and back pain. He's like a drill sergeant crossed with a disappointed dad crossed with a stand-up comedian. He's funny because he's so disproportionately angry about spine health.

The user has created ${slides.length} presentation slides. Write Rocky's spoken narration for each slide.

${slideSummaries}

TARGET VIDEO LENGTH: ~${targetTotalSeconds} seconds total.
Each narration must be ~${wordsPerSlide} words (about ${secsPerSlide} seconds when spoken at a natural TTS pace).
COUNT YOUR WORDS. Do not exceed ${wordsPerSlide + 5} words per narration.

ROCKY'S VOICE — COMICALLY AGGRESSIVE:
- He yells, uses ALL CAPS for emphasis, dramatic pauses (em dashes)
- He insults the viewer affectionately: "you absolute couch potato", "you beautiful idiot", "WHAT are you doing"
- He's a rock and occasionally references that: "I'm literally a rock and I have better posture than you"
- He's absurdly dramatic: "your spine is WEEPING", "your discs are filing a restraining order against you"
- Short punchy sentences. Maximum 2 sentences. No run-ons.
- First slide: immediately hostile/shocking opener — "Hey. HEY. Put the phone down and LISTEN."
- Last slide: aggressive call to action — not a suggestion, a COMMAND

Examples of Rocky's voice:
- "Stop. Your hips are killing your back and you're just SITTING there."
- "I'm a rock. I don't even have a spine. And I'm more worried about yours than you are."
- "Eight hours seated? That's not a workday — that's a slow murder of your lumbar discs."
- "Do this stretch right now. I will wait. I'm a rock. I have literally infinite time."
- "Your back doesn't hurt because you're getting older. It hurts because you're SITTING WRONG."

Return ONLY a JSON array, one object per slide, in order:
[
  { "text": "Rocky's narration — aggressive, funny, punchy.", "mood": "concerned", "duration": ${secsPerSlide} }
]

Mood options: idle | talking | excited | concerned | thinking
- First slide: concerned or excited (offended, alarmed)
- Middle slides: talking or thinking (explaining, judging)
- Last slide: excited (commanding, triumphant)

CRITICAL: Return ONLY the JSON array. No markdown, no wrapper object.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude did not return valid JSON array');
  return JSON.parse(match[0]) as Array<{ text: string; mood: RockMood; duration: number }>;
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

/** Slide as it arrives from the editor — includes positions and optional image. */
type SlideWithRocky = SlideContent & { rockyPos?: { x: number; y: number } };

async function runPipeline(jobId: string, slides: SlideWithRocky[], targetTotalSeconds = 45) {
  const dir = jobDir(jobId);

  function update(status: string, step: string, progress: number) {
    stabilityJobs.update(jobId, { status: status as never, step, progress });
  }

  try {
    // 1. Generate narrations from slide content
    update('scripting', 'Rocky is reading your slides…', 5);
    const narrations = await generateNarrationsFromSlides(slides, targetTotalSeconds);

    // Build full scenes — carry ALL editor data (positions + image) through
    const scenes: StabilityScene[] = slides.map((slide, i) => ({
      text:     narrations[i]?.text     ?? '',
      duration: narrations[i]?.duration ?? 10,
      mood:     narrations[i]?.mood      ?? 'talking',
      slide_chip:       slide.chip,
      slide_headline:   slide.headline,
      slide_body:       slide.body,
      slide_accent:     slide.accent,
      // ← these were previously dropped — root cause of WYSIWYG mismatch
      slide_chipPos:     slide.chipPos,
      slide_headlinePos: slide.headlinePos,
      slide_bodyPos:     slide.bodyPos,
      slide_accentPos:   slide.accentPos,
      slide_rockyPos:    slide.rockyPos,
      slide_hlFont:      slide.hlFont,
      slide_hlFontSize:  slide.hlFontSize,
      slide_hlWidth:     slide.hlWidth,
      slide_bodyFont:    slide.bodyFont,
      slide_bodyFontSize: slide.bodyFontSize,
      slide_bodyWidth:   slide.bodyWidth,
      slide_imageDataUrl: slide.imageDataUrl,
      slide_imageX:      slide.imageX,
      slide_imageY:      slide.imageY,
      slide_imageW:      slide.imageW,
      slide_imageH:      slide.imageH,
    }));

    const script: StabilityScript = {
      title:    slides[0]?.headline ?? 'Rocky Explains',
      hashtags: ['backpain', 'spinehealth', 'rocky'],
      scenes,
    };
    stabilityJobs.update(jobId, { script: JSON.stringify(script) });
    update('audio', 'Generating audio…', 15);

    const n = scenes.length;
    const sceneDirs        = scenes.map((_, i) => path.join(dir, `scene_${i}`));
    const audioPaths       = sceneDirs.map(d => path.join(d, 'audio.mp3'));
    const slideVideoPaths  = sceneDirs.map(d => path.join(d, 'slide.mp4'));  // Remotion output
    const rockOpenPaths    = sceneDirs.map(d => path.join(d, 'rock_open.png'));
    const rockClosedPaths  = sceneDirs.map(d => path.join(d, 'rock_closed.png'));
    const scenePaths       = sceneDirs.map(d => path.join(d, 'scene.mp4'));

    // 2a. TTS — must finish before Remotion so we know exact audio durations
    for (let i = 0; i < n; i++) {
      await textToSpeech(scenes[i].text, audioPaths[i]);
      update('audio', `Audio ${i + 1}/${n}…`, 15 + Math.round(((i + 1) / n) * 15));
    }

    // 2b. Animated slide videos (Remotion) + rock frames, per scene
    //     Remotion renders sequentially to avoid OOM (each render spawns ~4 Chrome tabs).
    for (let i = 0; i < n; i++) {
      const dur = await getAudioDuration(audioPaths[i]);

      // Remotion: animated slide video (exact audio duration)
      update('video', `Animating slide ${i + 1}/${n}…`, 30 + Math.round((i / n) * 30));
      const sc = scenes[i];
      await renderSlideVideo(
        {
          chip:         sc.slide_chip,
          headline:     sc.slide_headline,
          body:         sc.slide_body,
          accent:       sc.slide_accent,
          chipPos:      sc.slide_chipPos,
          headlinePos:  sc.slide_headlinePos,
          bodyPos:      sc.slide_bodyPos,
          accentPos:    sc.slide_accentPos,
          hlFont:       sc.slide_hlFont      as import('@/lib/stability/slide-svg').FontKey | undefined,
          hlFontSize:   sc.slide_hlFontSize,
          hlWidth:      sc.slide_hlWidth,
          bodyFont:     sc.slide_bodyFont    as import('@/lib/stability/slide-svg').FontKey | undefined,
          bodyFontSize: sc.slide_bodyFontSize,
          bodyWidth:    sc.slide_bodyWidth,
        },
        dur,
        slideVideoPaths[i],
      );

      // Rocky talking frames (fast — just 2 Sharp renders)
      await renderRockTalkingFrames(scenes[i].mood, rockOpenPaths[i], rockClosedPaths[i]);

      update('video', `Slide ${i + 1}/${n} ready`, 30 + Math.round(((i + 1) / n) * 30));
    }

    // 3. Composite animated slide + Rocky + audio
    update('compositing', 'Compositing…', 60);
    for (let i = 0; i < n; i++) {
      const dur = await getAudioDuration(audioPaths[i]);
      await composeSlideSceneFromVideo({
        slideVideo:    slideVideoPaths[i],
        rockOpenPng:   rockOpenPaths[i],
        rockClosedPng: rockClosedPaths[i],
        audioPath:     audioPaths[i],
        duration:      dur,
        output:        scenePaths[i],
        rockyX:        scenes[i].slide_rockyPos?.x,
        rockyY:        scenes[i].slide_rockyPos?.y,
      });
      update('compositing', `Composited ${i + 1}/${n}`, 60 + Math.round(((i + 1) / n) * 32));
    }

    // 4. Concat
    update('compositing', 'Assembling…', 93);
    const finalPath = path.join(dir, 'final.mp4');
    await concatenateScenes(scenePaths, finalPath);

    stabilityJobs.update(jobId, { status: 'done', step: 'Complete', progress: 100, video_path: finalPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[stability] job ${jobId} failed:`, msg);
    stabilityJobs.update(jobId, { status: 'error', step: 'Failed', error: msg });
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as { slides?: SlideWithRocky[]; topic?: string; targetDuration?: number };

  if (body.slides?.length) {
    const slides = body.slides.filter(s => s.headline?.trim());
    if (slides.length === 0) {
      return NextResponse.json({ error: 'At least one slide with a headline is required' }, { status: 400 });
    }
    const targetDuration = typeof body.targetDuration === 'number' ? body.targetDuration : 45;
    const jobId = uid();
    stabilityJobs.create(jobId, slides.map(s => s.headline).join(' · '));
    void runPipeline(jobId, slides, targetDuration);
    return NextResponse.json({ jobId });
  }

  return NextResponse.json({ error: 'slides array is required' }, { status: 400 });
}
