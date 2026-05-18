'use client';

import { useState } from 'react';

interface PinImage {
  id: string;
  url: string;
  previewUrl: string;
}

interface Props {
  initialQuery?: string;
  onSelect: (previewUrl: string, fullUrl: string) => void;
  onClose: () => void;
}

export default function PinterestSearchModal({ initialQuery = '', onSelect, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PinImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const res = await fetch(`/api/images?query=${encodeURIComponent(query)}&mode=search&count=12`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResults(json.photos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 fill-current">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
            <span className="font-bold text-gray-900">Search Pinterest</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-full px-4 py-2.5 focus-within:border-gray-400 transition-colors">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Search Pinterest"
                className="flex-1 outline-none text-gray-800 text-sm bg-transparent"
                autoFocus
              />
            </div>
            <button
              onClick={search}
              disabled={loading || !query.trim()}
              className="bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Search
            </button>
          </div>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
              <span className="ml-3 text-gray-500 text-sm">Scraping Pinterest…</span>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {results.map(img => (
                <button
                  key={img.id}
                  onClick={() => onSelect(img.previewUrl, img.url)}
                  className="aspect-[3/4] rounded-lg overflow-hidden ring-1 ring-gray-100 hover:ring-2 hover:ring-blue-500 transition-all group"
                >
                  <img
                    src={img.previewUrl}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : searched ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <span className="text-2xl">🔍</span>
              <p className="text-sm">No results found</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <span className="text-2xl">📌</span>
              <p className="text-sm">Search for photos from Pinterest</p>
              <p className="text-xs text-gray-300">Takes ~10s on first search (cached after)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
