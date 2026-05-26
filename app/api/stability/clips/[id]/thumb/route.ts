import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { anatomyClips } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clip = anatomyClips.get(id);

  if (!clip || !clip.thumb_path) {
    return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
  }

  if (!fs.existsSync(clip.thumb_path)) {
    return NextResponse.json({ error: 'Thumbnail file missing' }, { status: 404 });
  }

  const stat = fs.statSync(clip.thumb_path);
  const data = fs.readFileSync(clip.thumb_path);

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
