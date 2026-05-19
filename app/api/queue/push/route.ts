/**
 * POST /api/queue/push
 * Renders slides to PNGs then adds to the posting queue.
 * Returns the queue item with scheduled_at so the UI can show "Scheduled for X".
 */
import { NextRequest, NextResponse } from 'next/server';
import { renderSlides, SlideData } from '@/lib/render';
import { fetchAndCropImage } from '@/lib/images';
import { addToQueue } from '@/lib/queue';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { title, template, niche, tone, caption, hashtags, slides, textCustomizations } =
      await req.json();

    if (!title || !slides?.length) {
      return NextResponse.json({ error: 'title and slides are required' }, { status: 400 });
    }

    // ── Resolve image URLs ────────────────────────────────────────────────
    const resolvedSlides: SlideData[] = await Promise.all(
      slides.map(async (slide: {
        headline: string; body?: string; image_search: string; overlay_style: string;
      }, i: number) => {
        const custom = textCustomizations?.[i];
        const imageUrl: string = custom?.imageUrl
          ? custom.imageUrl
          : await fetchAndCropImage(slide.image_search, 0).catch(() => '');

        return {
          headline:      slide.headline,
          headlineHtml:  custom?.headlineHtml ?? slide.headline,
          bodyHtml:      custom?.bodyHtml ?? (slide.body ?? ''),
          imageUrl,
          overlay_style: slide.overlay_style ?? 'dark-cinematic',
          template:      template ?? 'dark-cinematic',
          hlX:           custom?.hlX      ?? 50,
          hlY:           custom?.hlY      ?? 45,
          bodyX:         custom?.bodyX    ?? 50,
          bodyY:         custom?.bodyY    ?? 68,
          hlStyle:       custom?.hlStyle  ?? 'default',
          bodyStyle:     custom?.bodyStyle ?? 'default',
          hlFont:        custom?.hlFont,
          bodyFont:      custom?.bodyFont,
          hlFontSize:    custom?.hlFontSize,
          bodyFontSize:  custom?.bodyFontSize,
          hlWidth:       custom?.hlWidth,
          bodyWidth:     custom?.bodyWidth,
        } satisfies SlideData;
      })
    );

    // ── Render PNGs ───────────────────────────────────────────────────────
    const outputPaths = await renderSlides(resolvedSlides, title);

    // Append CTA if it exists
    const ctaSrc = path.join(process.cwd(), 'public', 'cta.png');
    if (fs.existsSync(ctaSrc)) {
      const ctaDest = path.join(
        path.dirname(outputPaths[0]),
        `slide-${String(outputPaths.length + 1).padStart(2, '0')}.png`,
      );
      fs.copyFileSync(ctaSrc, ctaDest);
      outputPaths.push(ctaDest);
    }

    const outputDir = path.dirname(outputPaths[0]);

    // ── Add to queue ──────────────────────────────────────────────────────
    const item = addToQueue({
      title,
      caption,
      hashtags,
      output_dir: outputDir,
      slide_paths: outputPaths,
    });

    return NextResponse.json({ item });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[queue/push]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
