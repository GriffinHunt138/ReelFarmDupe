import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/queue';

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    saveSettings({ posts_per_day: body.posts_per_day, post_times: body.post_times });
    return NextResponse.json(getSettings());
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
