import { NextResponse } from 'next/server';
import crypto from 'crypto';

// GET /api/auth/tiktok — initiates OAuth flow
export async function GET() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return NextResponse.json({ error: 'TIKTOK_CLIENT_KEY not configured' }, { status: 500 });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/auth/tiktok/callback`;

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: 'user.info.basic,video.publish,video.upload',
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  // Store state in a short-lived cookie for CSRF validation
  response.cookies.set('tiktok_oauth_state', state, {
    httpOnly: true,
    maxAge: 600,
    path: '/',
  });
  return response;
}
