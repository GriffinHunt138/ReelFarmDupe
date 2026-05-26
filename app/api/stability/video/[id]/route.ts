import { NextRequest, NextResponse } from 'next/server';
import { stabilityJobs } from '@/lib/db';
import fs from 'fs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = stabilityJobs.get(id);

  if (!job?.video_path || !fs.existsSync(job.video_path)) {
    return NextResponse.json({ error: 'video not found' }, { status: 404 });
  }

  const stat   = fs.statSync(job.video_path);
  const buffer = fs.readFileSync(job.video_path);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'video/mp4',
      'Content-Length':      String(stat.size),
      'Content-Disposition': `inline; filename="${id}.mp4"`,
    },
  });
}
