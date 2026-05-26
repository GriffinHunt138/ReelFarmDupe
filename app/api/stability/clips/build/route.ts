import { NextRequest, NextResponse } from 'next/server';
import { buildClipLibrary } from '@/lib/stability/clip-library';

// ─── POST /api/stability/clips/build ─────────────────────────────────────────
// Body: { all: true } | { ids: string[] }
// Fire-and-forget: returns { started: true } immediately; client polls GET /api/stability/clips.

export async function POST(req: NextRequest) {
  let body: { all?: boolean; ids?: string[] } = {};
  try { body = await req.json(); } catch { /* empty body = build all */ }

  const ids = body.ids && body.ids.length > 0 ? body.ids : undefined;

  // Fire-and-forget — runs Higgsfield sequentially in background
  void buildClipLibrary(ids).then(count => {
    console.log(`[clip-library] Build complete — ${count} clips generated`);
  }).catch(err => {
    console.error('[clip-library] Build error:', err);
  });

  return NextResponse.json({ started: true, ids: ids ?? 'all' });
}
