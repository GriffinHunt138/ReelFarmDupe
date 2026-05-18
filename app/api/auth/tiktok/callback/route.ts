import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { db } from '@/lib/db';

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_in: number;
  token_type: string;
}

interface TikTokUserResponse {
  data: {
    user: {
      display_name: string;
      avatar_url: string;
      open_id: string;
    };
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(`${baseUrl}?tiktok_error=${encodeURIComponent(error)}`);
  }

  const storedState = req.cookies.get('tiktok_oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${baseUrl}?tiktok_error=state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}?tiktok_error=no_code`);
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/tiktok/callback`;

    // Exchange code for tokens
    const tokenRes = await axios.post<TikTokTokenResponse>(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY ?? '',
        client_secret: process.env.TIKTOK_CLIENT_SECRET ?? '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, open_id, expires_in } = tokenRes.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Fetch user info
    let username = null;
    let avatarUrl = null;
    try {
      const userRes = await axios.get<TikTokUserResponse>(
        'https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url,open_id',
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      username = userRes.data.data.user.display_name;
      avatarUrl = userRes.data.data.user.avatar_url;
    } catch {
      // non-fatal
    }

    db.saveTikTokAuth({ access_token, refresh_token, open_id, username, avatar_url: avatarUrl, expires_at: expiresAt });

    const res = NextResponse.redirect(`${baseUrl}?tiktok_connected=1`);
    res.cookies.delete('tiktok_oauth_state');
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'token_exchange_failed';
    console.error('[tiktok callback]', err);
    return NextResponse.redirect(`${baseUrl}?tiktok_error=${encodeURIComponent(message)}`);
  }
}
