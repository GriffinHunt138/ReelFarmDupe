'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ClipRow {
  id: string;
  category: string;
  tags: string;    // JSON array string
  label: string;
  prompt: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  video_path: string | null;
  thumb_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

type AnatomyCategory =
  | 'vertebral' | 'muscle' | 'nerve' | 'ligament'
  | 'posture' | 'movement' | 'circulation';

const CATEGORY_COLORS: Record<AnatomyCategory, string> = {
  vertebral:   'bg-blue-100 text-blue-700',
  muscle:      'bg-orange-100 text-orange-700',
  nerve:       'bg-yellow-100 text-yellow-700',
  ligament:    'bg-purple-100 text-purple-700',
  posture:     'bg-green-100 text-green-700',
  movement:    'bg-cyan-100 text-cyan-700',
  circulation: 'bg-red-100 text-red-700',
};

const CATEGORY_ORDER: AnatomyCategory[] = [
  'vertebral', 'muscle', 'nerve', 'ligament', 'posture', 'movement', 'circulation',
];

function Spinner({ cls = 'w-4 h-4' }: { cls?: string }) {
  return (
    <svg className={`${cls} animate-spin text-gray-400`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function StatusDot({ status }: { status: ClipRow['status'] }) {
  const cls =
    status === 'ready'      ? 'bg-green-400' :
    status === 'generating' ? 'bg-blue-400 animate-pulse' :
    status === 'error'      ? 'bg-red-400' :
                              'bg-gray-300';
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}

interface CategoryBarProps {
  category: AnatomyCategory;
  clips: ClipRow[];
}

function CategoryBar({ category, clips }: CategoryBarProps) {
  const total = clips.length;
  const ready = clips.filter(c => c.status === 'ready').length;
  const generating = clips.filter(c => c.status === 'generating').length;
  const error = clips.filter(c => c.status === 'error').length;
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${CATEGORY_COLORS[category]}`}>
            {category}
          </span>
          {generating > 0 && <Spinner cls="w-3 h-3" />}
        </div>
        <span className="text-[10px] text-gray-400">
          {ready}/{total}
          {error > 0 && <span className="text-red-400 ml-1">({error} err)</span>}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-800 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface ClipCardProps {
  clip: ClipRow;
  onPreview: (clip: ClipRow) => void;
  onRetry: (id: string) => void;
}

function ClipCard({ clip, onPreview, onRetry }: ClipCardProps) {
  const tags: string[] = JSON.parse(clip.tags);
  const cat = clip.category as AnatomyCategory;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border transition-all
        ${clip.status === 'ready'
          ? 'border-gray-200 hover:border-gray-400 cursor-pointer hover:shadow-md'
          : 'border-gray-100'
        }`}
      onClick={() => clip.status === 'ready' && onPreview(clip)}
    >
      {/* Thumbnail / placeholder */}
      <div className="aspect-[9/16] bg-gray-900 relative overflow-hidden">
        {clip.thumb_path && clip.status === 'ready' ? (
          <img
            src={`/api/stability/clips/${clip.id}/thumb`}
            alt={clip.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            {clip.status === 'generating' ? (
              <>
                <Spinner cls="w-5 h-5" />
                <span className="text-[9px] text-gray-500">Generating…</span>
              </>
            ) : clip.status === 'error' ? (
              <>
                <span className="text-red-400 text-lg">✕</span>
                <span className="text-[9px] text-red-400 text-center px-2">{clip.error?.slice(0, 40)}</span>
              </>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center">
                <span className="text-gray-600 text-[10px]">?</span>
              </div>
            )}
          </div>
        )}

        {/* Status dot overlay */}
        <div className="absolute top-1.5 right-1.5">
          <StatusDot status={clip.status} />
        </div>

        {/* Category badge */}
        <div className="absolute top-1.5 left-1.5">
          <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${CATEGORY_COLORS[cat]}`}>
            {cat.slice(0, 4)}
          </span>
        </div>

        {/* Play overlay for ready clips */}
        {clip.status === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
              <span className="text-gray-900 text-lg ml-0.5">▶</span>
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="p-2 bg-white">
        <p className="text-[10px] font-semibold text-gray-700 truncate">{clip.label}</p>
        <div className="flex flex-wrap gap-0.5 mt-1">
          {tags.slice(0, 3).map(t => (
            <span key={t} className="text-[8px] bg-gray-100 text-gray-500 px-1 rounded">
              {t}
            </span>
          ))}
        </div>
        {clip.status === 'error' && (
          <button
            onClick={e => { e.stopPropagation(); onRetry(clip.id); }}
            className="mt-1.5 text-[9px] text-red-500 underline hover:text-red-700"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ClipLibraryPanel() {
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [previewClip, setPreviewClip] = useState<ClipRow | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AnatomyCategory | 'all'>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchClips = useCallback(async () => {
    try {
      const res = await fetch('/api/stability/clips');
      if (!res.ok) return;
      const data = await res.json() as { clips: ClipRow[] };
      setClips(data.clips);

      // If any are generating, keep polling; otherwise stop
      const stillRunning = data.clips.some(c => c.status === 'generating');
      if (!stillRunning) {
        setBuilding(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch { /* non-fatal */ }
  }, []);

  // Initial load
  useEffect(() => {
    fetchClips().finally(() => setLoading(false));
  }, [fetchClips]);

  // Poll while building
  useEffect(() => {
    if (building && !pollRef.current) {
      pollRef.current = setInterval(fetchClips, 5_000);
    }
    return () => {
      if (pollRef.current && !building) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [building, fetchClips]);

  async function handleBuildMissing() {
    setBuilding(true);
    try {
      await fetch('/api/stability/clips/build', { method: 'POST', body: JSON.stringify({ all: true }), headers: { 'Content-Type': 'application/json' } });
      // Start polling
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchClips, 5_000);
      }
      // Optimistically mark pending clips as "generating" in UI
      setClips(prev => prev.map(c =>
        c.status === 'pending' || c.status === 'error'
          ? { ...c, status: 'generating' }
          : c
      ));
    } catch {
      setBuilding(false);
    }
  }

  async function handleRetry(id: string) {
    setBuilding(true);
    try {
      await fetch('/api/stability/clips/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      setClips(prev => prev.map(c => c.id === id ? { ...c, status: 'generating' } : c));
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchClips, 5_000);
      }
    } catch { /* non-fatal */ }
  }

  // Derived stats
  const totalReady   = clips.filter(c => c.status === 'ready').length;
  const totalClips   = clips.length;
  const totalError   = clips.filter(c => c.status === 'error').length;
  const hasMissing   = clips.some(c => c.status === 'pending' || c.status === 'error');

  const byCategory = (cat: AnatomyCategory) =>
    clips.filter(c => c.category === cat);

  const displayedClips = selectedCategory === 'all'
    ? clips
    : clips.filter(c => c.category === selectedCategory);

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      {/* Left panel — stats + controls */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
        <div className="p-5 space-y-5">

          {/* Header */}
          <div>
            <h2 className="font-bold text-sm text-gray-900">Clip Library</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {loading
                ? 'Loading…'
                : `${totalReady} / ${totalClips} clips ready`
              }
            </p>
          </div>

          {/* Overall progress */}
          {!loading && totalClips > 0 && (
            <div className="space-y-1">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-800 rounded-full transition-all duration-700"
                  style={{ width: `${Math.round((totalReady / totalClips) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 text-right">
                {Math.round((totalReady / totalClips) * 100)}% ready
              </p>
            </div>
          )}

          {/* Build button */}
          {!loading && (
            <div className="space-y-2">
              <button
                onClick={handleBuildMissing}
                disabled={building || !hasMissing}
                className="w-full bg-gray-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {building ? (
                  <><Spinner cls="w-3.5 h-3.5" /><span>Building…</span></>
                ) : (
                  `▶ Build ${hasMissing ? 'Missing' : 'All'} Clips`
                )}
              </button>
              {building && (
                <p className="text-[10px] text-gray-400 text-center">
                  Generating ~4-5 min per clip. Polling every 5s.
                </p>
              )}
            </div>
          )}

          {/* Category progress bars */}
          {!loading && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Categories</p>
              {CATEGORY_ORDER.map(cat => (
                <CategoryBar key={cat} category={cat} clips={byCategory(cat)} />
              ))}
            </div>
          )}

          {/* Error summary */}
          {totalError > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-medium text-red-700">{totalError} clips failed</p>
              <p className="text-[10px] text-red-500 mt-0.5">Click "Retry" on individual cards</p>
            </div>
          )}

        </div>
      </div>

      {/* Right panel — clip grid */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {(['all', ...CATEGORY_ORDER] as Array<'all' | AnatomyCategory>).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors
                ${selectedCategory === cat
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
            >
              {cat}
              {cat !== 'all' && (
                <span className="ml-1 opacity-60">
                  {byCategory(cat).filter(c => c.status === 'ready').length}/{byCategory(cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {loading && (
          <div className="flex items-center justify-center h-48 gap-3">
            <Spinner cls="w-6 h-6" />
            <span className="text-sm text-gray-400">Loading clip library…</span>
          </div>
        )}

        {!loading && displayedClips.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <p className="text-sm text-gray-500 font-medium">No clips yet</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Click "Build Missing Clips" to generate your anatomy library. Each clip takes ~4-5 minutes.
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && displayedClips.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {displayedClips.map(clip => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onPreview={setPreviewClip}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}

      </div>

      {/* Preview modal */}
      {previewClip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
          onClick={() => setPreviewClip(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative bg-black aspect-[9/16]">
              <video
                src={`/api/stability/clips/${previewClip.id}/video`}
                controls
                autoPlay
                playsInline
                loop
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${CATEGORY_COLORS[previewClip.category as AnatomyCategory]}`}>
                  {previewClip.category}
                </span>
                <h3 className="font-bold text-sm text-gray-900">{previewClip.label}</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                {(JSON.parse(previewClip.tags) as string[]).map(t => (
                  <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 italic leading-relaxed">{previewClip.prompt.slice(0, 120)}…</p>
              <button
                onClick={() => setPreviewClip(null)}
                className="w-full mt-2 bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
