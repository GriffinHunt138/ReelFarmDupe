import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { anatomyClips } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clip = anatomyClips.get(id);

  if (!clip || clip.status !== 'ready' || !clip.video_path) {
    return NextResponse.json({ error: 'Clip not found or not ready' }, { status: 404 });
  }

  if (!fs.existsSync(clip.video_path)) {
    return NextResponse.json({ error: 'Video file missing' }, { status: 404 });
  }

  const stat = fs.statSync(clip.video_path);
  const stream = fs.createReadStream(clip.video_path);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
