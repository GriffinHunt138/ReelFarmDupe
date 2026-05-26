import { NextResponse } from 'next/server';
import { anatomyClips } from '@/lib/db';
import { seedClipDefinitions } from '@/lib/stability/clip-library';

// ─── GET /api/stability/clips ─────────────────────────────────────────────────
// Returns all anatomy_clips rows (for the Library UI to poll).

export async function GET() {
  try {
    seedClipDefinitions(); // Ensure seed rows exist on first visit
    const clips = anatomyClips.list();
    return NextResponse.json({ clips });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
