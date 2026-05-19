import { NextRequest, NextResponse } from 'next/server';
import { removeFromQueue, updateQueueItem, getQueueItem } from '@/lib/queue';

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    removeFromQueue(id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, scheduled_at } = await req.json();
    if (!id || !scheduled_at) return NextResponse.json({ error: 'id and scheduled_at required' }, { status: 400 });
    updateQueueItem(id, { scheduled_at } as never);
    return NextResponse.json({ ok: true, item: getQueueItem(id) });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
