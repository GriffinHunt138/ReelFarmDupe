'use client';

import { useState } from 'react';

interface Props {
  postId: number | null;
  outputDir: string | null;
  slidePaths: string[];
  previews: string[];
  tiktokConnected: boolean;
  title?: string;
}

export default function ExportPanel({ postId, outputDir, slidePaths, previews, tiktokConnected, title }: Props) {
  const [posting,    setPosting]    = useState(false);
  const [zipping,   setZipping]    = useState(false);
  const [savedZip,  setSavedZip]   = useState<string | null>(null);
  const [zipError,  setZipError]   = useState('');
  const [postResult, setPostResult] = useState<{ success?: boolean; error?: string } | null>(null);

  async function saveZip() {
    if (!slidePaths.length) return;
    setZipping(true);
    setZipError('');
    setSavedZip(null);
    try {
      const res  = await fetch('/api/export/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slidePaths, title }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedZip(data.zipPath);
    } catch (e: unknown) {
      setZipError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setZipping(false);
    }
  }

  async function postToTikTok() {
    if (!postId) return;
    setPosting(true);
    setPostResult(null);
    try {
      const res = await fetch('/api/export/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json();
      if (data.success) {
        setPostResult({ success: true });
      } else {
        setPostResult({ error: data.error ?? 'Unknown error' });
      }
    } catch (e: unknown) {
      setPostResult({ error: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setPosting(false);
    }
  }

  const hasSlides = previews.length > 0;

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Export</div>

      {!hasSlides && (
        <div className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          Render your slides first to unlock export options.
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={saveZip}
          disabled={!hasSlides || zipping}
          className="flex items-center gap-2 bg-gray-900 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {zipping ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Saving…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Save ZIP
            </>
          )}
        </button>

        <button
          onClick={postToTikTok}
          disabled={!hasSlides || !tiktokConnected || posting}
          className="flex items-center gap-2 bg-[#010101] border border-white/20 hover:border-white/40 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {posting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Posting…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.53V6.88a4.85 4.85 0 01-1.01-.19z"/>
              </svg>
              Post to TikTok
            </>
          )}
        </button>
      </div>

      {!tiktokConnected && hasSlides && (
        <div className="text-xs text-gray-400">Connect your TikTok account above to enable direct posting.</div>
      )}

      {postResult?.success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Successfully posted to TikTok!
        </div>
      )}

      {postResult?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {postResult.error}
        </div>
      )}

      {savedZip && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-green-700 text-xs">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-mono break-all">{savedZip}</span>
        </div>
      )}
      {zipError && (
        <div className="text-red-500 text-xs">{zipError}</div>
      )}
    </div>
  );
}
