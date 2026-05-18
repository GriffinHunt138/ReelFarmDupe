import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  db.deleteTikTokAuth();
  return NextResponse.json({ success: true });
}
