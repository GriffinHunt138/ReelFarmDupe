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
    const existing = getQueueItem(id);
    // Reset failed/posted items back to pending so the worker picks them up again
    const needsReset = existing?.status === 'failed' || existing?.status === 'posted';
    const statusReset = needsReset ? { status: 'pending' as const, error_msg: null } : {};
    updateQueueItem(id, { scheduled_at, ...statusReset } as never);
    return NextResponse.json({ ok: true, item: getQueueItem(id) });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
