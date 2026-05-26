import { NextRequest, NextResponse } from 'next/server';
import { stabilityJobs } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = stabilityJobs.get(id);
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    id:         job.id,
    status:     job.status,
    step:       job.step,
    progress:   job.progress,
    topic:      job.topic,
    error:      job.error,
    videoReady: job.status === 'done' && !!job.video_path,
    script:     job.script ? JSON.parse(job.script) : null,
    createdAt:  job.created_at,
  });
}
