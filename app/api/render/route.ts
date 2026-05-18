import { NextRequest, NextResponse } from 'next/server';
import { renderSlides, SlideData } from '@/lib/render';
import { fetchAndCropImage } from '@/lib/images';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { title, template, niche, tone, caption, hashtags, slides, textCustomizations } = await req.json();

    if (!title || !slides?.length) {
      return NextResponse.json({ error: 'title and slides are required' }, { status: 400 });
    }

    const resolvedSlides: SlideData[] = await Promise.all(
      slides.map(async (slide: {
        headline: string;
        body?: string;
        image_search: string;
        overlay_style: string;
      }, i: number) => {
        const custom = textCustomizations?.[i];

        // Use the exact image the editor was showing.
        // imageUrl is the 736x Pinterest URL stored in textCustomizations.
        // If for some reason it's missing, fall back to a fresh fetch.
        const imageUrl: string = custom?.imageUrl
          ? custom.imageUrl
          : await fetchAndCropImage(slide.image_search, 0).catch(() => '');

        return {
          headline:      slide.headline,
          headlineHtml:  custom?.headlineHtml ?? slide.headline,
          bodyHtml:      custom?.bodyHtml     ?? (slide.body ?? ''),
          imageUrl,
          overlay_style: slide.overlay_style ?? 'dark-cinematic',
          template:      template ?? 'dark-cinematic',
          hlX:           custom?.hlX       ?? 50,
          hlY:           custom?.hlY       ?? 45,
          bodyX:         custom?.bodyX     ?? 50,
          bodyY:         custom?.bodyY     ?? 68,
          hlStyle:       custom?.hlStyle    ?? 'default',
          bodyStyle:     custom?.bodyStyle  ?? 'default',
          hlFont:        custom?.hlFont     ?? undefined,
          bodyFont:      custom?.bodyFont   ?? undefined,
          hlFontSize:    custom?.hlFontSize  ?? undefined,
          bodyFontSize:  custom?.bodyFontSize ?? undefined,
        } satisfies SlideData;
      })
    );

    const outputPaths = await renderSlides(resolvedSlides, title);

    // Always append cta.png as the final slide
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
    const relativeOutputDir = path.relative(process.cwd(), outputDir);

    const post = db.createPost({
      title,
      niche:          niche   ?? null,
      tone:           tone    ?? null,
      template:       template ?? null,
      slide_count:    slides.length,
      output_path:    relativeOutputDir,
      tiktok_post_id: null,
      caption:        caption  ?? null,
      hashtags:       hashtags ? JSON.stringify(hashtags) : null,
      slides_json:    JSON.stringify(slides),
    });

    // Return base64 data URLs so the client can trigger downloads directly.
    const previews = outputPaths.map(p => {
      const buf = fs.readFileSync(p);
      return `data:image/png;base64,${buf.toString('base64')}`;
    });

    return NextResponse.json({
      post_id:    post.id,
      output_dir: relativeOutputDir,
      slide_paths: outputPaths.map(p => path.relative(process.cwd(), p)),
      previews,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[render]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
