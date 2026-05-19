import { NextResponse } from 'next/server';
import { processQueue } from '@/lib/queue-worker';

export async function POST() {
  try {
    const result = await processQueue();
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
