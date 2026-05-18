import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({
    has_key: !!process.env.ANTHROPIC_API_KEY,
    key_prefix: process.env.ANTHROPIC_API_KEY?.slice(0, 15) ?? 'MISSING',
    cwd: process.cwd(),
  });
}
