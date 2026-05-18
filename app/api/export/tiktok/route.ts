import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

interface InitUploadResponse {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error?: { code: string; message: string };
}

// POST /api/export/tiktok
// Body: { post_id: number }
export async function POST(req: NextRequest) {
  try {
    const { post_id } = await req.json();
    if (!post_id) return NextResponse.json({ error: 'post_id is required' }, { status: 400 });

    const auth = db.getTikTokAuth();
    if (!auth) return NextResponse.json({ error: 'TikTok account not connected' }, { status: 401 });

    const post = db.getPost(post_id);
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (!post.output_path) return NextResponse.json({ error: 'Slides not yet rendered' }, { status: 400 });

    const outputDir = path.join(process.cwd(), post.output_path);
    const pngFiles = fs.readdirSync(outputDir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .map(f => path.join(outputDir, f));

    if (!pngFiles.length) return NextResponse.json({ error: 'No PNG slides found' }, { status: 400 });

    const caption = post.caption ?? post.title;
    const hashtags = post.hashtags ? (JSON.parse(post.hashtags) as string[]).map(h => `#${h}`).join(' ') : '';
    const fullCaption = `${caption} ${hashtags}`.trim();

    // Step 1: Initialize photo post upload
    const initRes = await axios.post<InitUploadResponse>(
      'https://open.tiktokapis.com/v2/post/publish/content/init/',
      {
        post_info: {
          title: fullCaption,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          photo_cover_index: 0,
          photo_images: pngFiles.map(() => ({ name: 'slide.png' })),
        },
        post_mode: 'DIRECT_POST',
        media_type: 'PHOTO',
      },
      {
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    );

    if (initRes.data.error?.code && initRes.data.error.code !== 'ok') {
      return NextResponse.json({ error: initRes.data.error.message }, { status: 400 });
    }

    const { publish_id, upload_url } = initRes.data.data;

    // Step 2: Upload each image
    for (const pngPath of pngFiles) {
      const buffer = fs.readFileSync(pngPath);
      await axios.put(upload_url, buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': buffer.length,
        },
      });
    }

    // Save TikTok post ID
    db.updatePost(post_id, { tiktok_post_id: publish_id });

    return NextResponse.json({ success: true, publish_id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[tiktok export]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
