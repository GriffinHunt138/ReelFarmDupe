import { NextResponse } from 'next/server';
import { listQueue } from '@/lib/queue';

export async function GET() {
  try {
    const items = listQueue();
    return NextResponse.json({ items });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
