'use client';

import { useEffect, useState } from 'react';

interface TikTokStatus {
  connected: boolean;
  username?: string;
  avatar_url?: string;
  expires_at?: string;
}

interface Props {
  onStatusChange?: (connected: boolean) => void;
}

export default function TikTokConnect({ onStatusChange }: Props) {
  const [status, setStatus] = useState<TikTokStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/auth/tiktok/status');
      const data = await res.json();
      setStatus(data);
      onStatusChange?.(data.connected);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function disconnect() {
    setDisconnecting(true);
    await fetch('/api/auth/tiktok/disconnect', { method: 'POST' });
    await fetchStatus();
    setDisconnecting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-gray-200" />
        <div className="h-3 w-32 bg-gray-200 rounded" />
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          {status.avatar_url ? (
            <img src={status.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
              TK
            </div>
          )}
          <div>
            <div className="text-gray-900 text-sm font-semibold">@{status.username ?? 'TikTok User'}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-green-600 text-xs">Connected</span>
            </div>
          </div>
        </div>
        <button
          onClick={disconnect}
          disabled={disconnecting}
          className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/auth/tiktok"
      className="flex items-center justify-center gap-2.5 bg-[#010101] hover:bg-zinc-900 border border-gray-300 hover:border-gray-400 rounded-xl px-4 py-3 text-white text-sm font-semibold transition-all group"
    >
      {/* TikTok logo SVG */}
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.53V6.88a4.85 4.85 0 01-1.01-.19z"/>
      </svg>
      Connect TikTok Account
    </a>
  );
}
