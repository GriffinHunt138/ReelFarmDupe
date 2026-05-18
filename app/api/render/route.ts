import { NextRequest, NextResponse } from 'next/server';
import { renderSlides, SlideData } from '@/lib/render';
import { fetchAndCropImage, cropImageFromUrl } from '@/lib/images';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { title, template, niche, tone, caption, hashtags, slides, textCustomizations } = await req.json();

    if (!title || !slides?.length) {
      return NextResponse.json({ error: 'title and slides are required' }, { status: 400 });
    }

    // Resolve images for each slide
    const resolvedSlides: SlideData[] = await Promise.all(
      slides.map(async (slide: {
        headline: string;
        body?: string;
        image_search: string;
        overlay_style: string;
        animation_hint?: string;
      }, i: number) => {
        const custom = textCustomizations?.[i];
        // Slide 0 always uses "faceless ugc selfie"; all slides pick a random
        // result index so the same query yields different photos each render.
        const imageQuery = i === 0 ? 'faceless ugc selfie' : slide.image_search;
        const imageIndex = Math.floor(Math.random() * 15);
        const imagePath = custom?.imageUrl
          ? await cropImageFromUrl(custom.imageUrl)
          : await fetchAndCropImage(imageQuery, imageIndex);
        return {
          headline:     slide.headline,
          headlineHtml: custom?.headlineHtml ?? slide.headline,
          bodyHtml:     custom?.bodyHtml     ?? (slide.body ?? ''),
          image_url:    imagePath,
          overlay_style: slide.overlay_style ?? 'dark-cinematic',
          slide_number: `${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`,
          template:     template ?? 'dark-cinematic',
          hlX:      custom?.hlX      ?? 50,
          hlY:      custom?.hlY      ?? 45,
          bodyX:    custom?.bodyX    ?? 50,
          bodyY:    custom?.bodyY    ?? 68,
          hlStyle:  custom?.hlStyle  ?? 'default',
          bodyStyle: custom?.bodyStyle ?? 'default',
        };
      })
    );

    const outputPaths = await renderSlides(resolvedSlides, title);

    // Derive relative output directory
    const outputDir = path.dirname(outputPaths[0]);
    const relativeOutputDir = path.relative(process.cwd(), outputDir);

    // Save to DB
    const post = db.createPost({
      title,
      niche: niche ?? null,
      tone: tone ?? null,
      template: template ?? null,
      slide_count: slides.length,
      output_path: relativeOutputDir,
      tiktok_post_id: null,
      caption: caption ?? null,
      hashtags: hashtags ? JSON.stringify(hashtags) : null,
      slides_json: JSON.stringify(slides),
    });

    // Convert PNGs to base64 data URLs for preview
    const previews = outputPaths.map((p) => {
      const buf = fs.readFileSync(p);
      return `data:image/png;base64,${buf.toString('base64')}`;
    });

    return NextResponse.json({
      post_id: post.id,
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
