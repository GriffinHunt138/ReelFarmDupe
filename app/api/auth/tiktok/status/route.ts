import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const auth = db.getTikTokAuth();
  if (!auth) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    username: auth.username,
    avatar_url: auth.avatar_url,
    open_id: auth.open_id,
    expires_at: auth.expires_at,
  });
}
