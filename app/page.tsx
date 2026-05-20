'use client';

import { useState, useEffect } from 'react';
import TemplatePicker from '@/components/TemplatePicker';
import PreviewEditor, { TextCustomization, TextStyle } from '@/components/PreviewEditor';

// ── Constants ─────────────────────────────────────────────────────────────
const NICHES = ['Fitness', 'Mindset', 'Finance', 'Beauty', 'Travel', 'Food', 'Tech', 'Fashion', 'Health', 'Motivation', 'Business', 'Gaming'];
const TONES  = ['Inspirational', 'Dark & Moody', 'Hype / Energy', 'Calm & Aesthetic', 'Educational', 'Shocking / Bold', 'Cinematic'];
const SLIDE_COUNTS = [3, 4, 5, 6, 7, 8, 10];

// ── Queue types (mirrored from lib/queue.ts for client use) ───────────────
interface QueueItem {
  id: number;
  title: string;
  caption: string | null;
  scheduled_at: string;
  status: 'pending' | 'posting' | 'posted' | 'failed';
  error_msg: string | null;
  posted_at: string | null;
  created_at: string;
  slide_paths: string[];
}

interface QueueSettings {
  posts_per_day: number;
  post_times: string[];
  notify_phone: string;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Slide {
  headline: string;
  body?: string | null;
  image_search: string;
  overlay_style: string;
}

interface SavedSlideshow {
  id: string;
  title: string;
  template: string;
  niche: string;
  tone: string;
  slides: Slide[];
  textCustomizations: TextCustomization[];
  imageUrls: string[];
  caption: string;
  hashtags: string[];
  generatedAt: number;
}

type Tab = 'create' | 'batch' | 'library' | 'queue';

type BatchStatus = 'pending' | 'generating' | 'done' | 'error';

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

async function fetchPhotosForSlides(slides: Slide[]) {
  return Promise.all(
    slides.map(async (slide) => {
      try {
        const r = await fetch(`/api/images?query=${encodeURIComponent(slide.image_search)}&mode=search&count=8`);
        const json = await r.json();
        const photos: { previewUrl?: string; url?: string }[] = json.photos ?? [];
        const photo = photos.length > 0 ? photos[Math.floor(Math.random() * photos.length)] : null;
        return { previewUrl: (photo?.previewUrl ?? '') as string, imageUrl: (photo?.url ?? '') as string };
      } catch { return { previewUrl: '', imageUrl: '' }; }
    })
  );
}

function defaultCustomizations(slides: Slide[], topic: string, tmpl: string): TextCustomization[] {
  const isOrganic = tmpl === 'Organic Raw';
  return slides.map((s, i) => ({
    headlineHtml: i === 0 ? topic : s.headline,
    bodyHtml:     s.body ?? '',
    hlX: 50, hlY: isOrganic ? 38 : (i === 0 ? 30 : 28),
    bodyX: 50, bodyY: isOrganic ? 62 : (i === 0 ? 58 : 60),
    hlStyle:   (isOrganic ? 'white-bg' : 'default') as TextStyle,
    bodyStyle: 'default' as TextStyle,
    hlFont:   isOrganic ? 'montserrat' : 'bebas',
    bodyFont: isOrganic ? 'montserrat' : 'inter',
  } as TextCustomization));
}

async function renderAndZip(sw: SavedSlideshow): Promise<string> {
  const renderRes = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: sw.title, template: sw.template, niche: sw.niche, tone: sw.tone,
      caption: sw.caption, hashtags: sw.hashtags,
      slides: sw.slides, textCustomizations: sw.textCustomizations,
    }),
  });
  const renderData = await renderRes.json();
  if (renderData.error) throw new Error(renderData.error);

  const zipRes = await fetch('/api/export/zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slidePaths: renderData.slide_paths, title: sw.title }),
  });
  const zipData = await zipRes.json();
  if (zipData.error) throw new Error(zipData.error);
  return zipData.zipPath as string;
}

// ── Spinner ────────────────────────────────────────────────────────────────
function Spinner({ cls = 'w-4 h-4' }: { cls?: string }) {
  return (
    <svg className={`${cls} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeTab,      setActiveTab]      = useState<Tab>('create');
  const [library,        setLibrary]        = useState<SavedSlideshow[]>([]);
  const [libraryEditId,  setLibraryEditId]  = useState<string | null>(null);

  // ── Create tab ─────────────────────────────────────────────────────────
  const [topic,      setTopic]      = useState('');
  const [niche,      setNiche]      = useState('');
  const [tone,       setTone]       = useState('');
  const [template,   setTemplate]   = useState('Dark Cinematic');
  const [slideCount, setSlideCount] = useState(5);

  const [slideshow,          setSlideshow]          = useState<SavedSlideshow | null>(null);
  const [textCustomizations, setTextCustomizations] = useState<TextCustomization[]>([]);
  const [imageUrls,          setImageUrls]          = useState<string[]>([]);
  const [generating,         setGenerating]         = useState(false);
  const [genError,           setGenError]           = useState('');
  const [pushing,            setPushing]            = useState(false);
  const [pushScheduledAt,    setPushScheduledAt]    = useState<string | null>(null);
  const [pushError,          setPushError]          = useState('');

  // ── Batch tab ──────────────────────────────────────────────────────────
  const [batchSubject,    setBatchSubject]    = useState('');
  const [batchAudience,   setBatchAudience]   = useState('');
  const [batchNiche,      setBatchNiche]      = useState('');
  const [batchTone,       setBatchTone]       = useState('');
  const [batchTemplate,   setBatchTemplate]   = useState('Organic Raw');
  const [batchSlideCount, setBatchSlideCount] = useState(5);
  const [generatedTopics, setGeneratedTopics] = useState<string[]>([]);
  const [selectedTopics,  setSelectedTopics]  = useState<Set<number>>(new Set());
  const [topicsLoading,   setTopicsLoading]   = useState(false);
  const [topicsError,     setTopicsError]     = useState('');
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress,   setBatchProgress]   = useState<{ topic: string; status: BatchStatus }[]>([]);
  const [batchDone,       setBatchDone]       = useState(false);

  const [downloadedIds,  setDownloadedIds]  = useState<Set<string>>(new Set());

  // ── Library editor ─────────────────────────────────────────────────────
  const [libPushing,     setLibPushing]     = useState(false);
  const [libPushAt,      setLibPushAt]      = useState<string | null>(null);
  const [libPushError,   setLibPushError]   = useState('');

  // ── Queue tab ──────────────────────────────────────────────────────────
  const [queueItems,     setQueueItems]     = useState<QueueItem[]>([]);
  const [queueSettings,  setQueueSettings]  = useState<QueueSettings>({ posts_per_day: 6, post_times: ['09:00','11:00','13:00','15:00','17:00','19:00'], notify_phone: '+12035363028' });
  const [chromeConnected,    setChromeConnected]    = useState<boolean | null>(null);
  const [chromeLaunching,    setChromeLaunching]    = useState(false);
  const [settingsEditing,    setSettingsEditing]    = useState(false);
  const [queueSubTab,        setQueueSubTab]        = useState<'ready' | 'downloaded'>('ready');
  const [editTimes,          setEditTimes]          = useState<string[]>([]);
  const [editPpd,            setEditPpd]            = useState(6);
  const [editPhone,          setEditPhone]          = useState('+12035363028');
  const [editingScheduleId,  setEditingScheduleId]  = useState<number | null>(null);
  const [editSchedDate,      setEditSchedDate]      = useState('');
  const [editSchedTime,      setEditSchedTime]      = useState('');

  // ── Persist library + downloaded state across reloads ─────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rf_library');
      if (saved) setLibrary(JSON.parse(saved));
      const ids = localStorage.getItem('rf_downloaded');
      if (ids) setDownloadedIds(new Set(JSON.parse(ids)));
    } catch { /* ignore corrupt data */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem('rf_library', JSON.stringify(library)); } catch { /* quota */ }
  }, [library]);

  useEffect(() => {
    try { localStorage.setItem('rf_downloaded', JSON.stringify([...downloadedIds])); } catch { /* quota */ }
  }, [downloadedIds]);

  // Fetch queue + settings on mount; poll every 30s when Queue tab is active
  useEffect(() => {
    fetchQueue();
    fetchQueueSettings();
    checkChrome();
  }, []);

  useEffect(() => {
    if (activeTab !== 'queue') return;
    const t = setInterval(() => { fetchQueue(); checkChrome(); }, 30_000);
    return () => clearInterval(t);
  }, [activeTab]);

  // ── Library helpers ────────────────────────────────────────────────────
  function upsertLibrary(sw: SavedSlideshow) {
    setLibrary(prev => {
      const idx = prev.findIndex(s => s.id === sw.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = sw; return n; }
      return [sw, ...prev];
    });
  }

  function openLibraryEditor(id: string) {
    setLibraryEditId(id);
    setLibPushAt(null);
    setLibPushError('');
    setActiveTab('library');
  }

  // ── Create: generate ───────────────────────────────────────────────────
  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setGenError('');
    setSlideshow(null);
    setPushScheduledAt(null);

    try {
      const res  = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, niche, tone, template, slide_count: slideCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const slides: Slide[] = data.slideshow.slides;
      const customs = defaultCustomizations(slides, topic, template);
      const id = uid();
      const sw: SavedSlideshow = {
        id, title: data.slideshow.title, template, niche, tone,
        slides, textCustomizations: customs, imageUrls: [],
        caption: data.slideshow.caption, hashtags: data.slideshow.hashtags,
        generatedAt: Date.now(),
      };
      setSlideshow(sw);
      setTextCustomizations(customs);
      setImageUrls([]);
      upsertLibrary(sw);

      // Fetch images async
      fetchPhotosForSlides(slides).then(photos => {
        const urls = photos.map(p => p.imageUrl || p.previewUrl);
        const updatedCustoms = customs.map((c, i) => ({
          ...c, imageUrl: photos[i]?.imageUrl || '', previewUrl: photos[i]?.previewUrl || '',
        }));
        setImageUrls(urls);
        setTextCustomizations(updatedCustoms);
        const updated = { ...sw, imageUrls: urls, textCustomizations: updatedCustoms };
        setSlideshow(updated);
        upsertLibrary(updated);
      });
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function pushCurrent() {
    if (!slideshow) return;
    setPushing(true);
    setPushScheduledAt(null);
    setPushError('');
    try {
      const res = await fetch('/api/queue/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: slideshow.title, template, niche, tone,
          caption: slideshow.caption, hashtags: slideshow.hashtags,
          slides: slideshow.slides, textCustomizations,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPushScheduledAt(data.item.scheduled_at);
      if (slideshow.id) setDownloadedIds(prev => new Set([...prev, slideshow.id]));
      fetchQueue();
    } catch (e: unknown) {
      setPushError(e instanceof Error ? e.message : 'Push failed');
    } finally {
      setPushing(false);
    }
  }

  // ── Batch: generate topics ─────────────────────────────────────────────
  async function generateTopics() {
    if (!batchNiche && !batchTone) return;
    setTopicsLoading(true);
    setTopicsError('');
    setGeneratedTopics([]);
    setSelectedTopics(new Set());
    setBatchProgress([]);
    setBatchDone(false);
    try {
      const res  = await fetch('/api/generate-topics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: batchSubject, audience: batchAudience, niche: batchNiche, tone: batchTone, count: 10 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedTopics(data.topics);
    } catch (e: unknown) {
      setTopicsError(e instanceof Error ? e.message : 'Failed to generate topics');
    } finally {
      setTopicsLoading(false);
    }
  }

  // ── Batch: generate slideshows for selected topics ─────────────────────
  async function generateSelected() {
    const selected = generatedTopics.filter((_, i) => selectedTopics.has(i));
    if (!selected.length) return;
    setBatchGenerating(true);
    setBatchDone(false);
    setBatchProgress(selected.map(t => ({ topic: t, status: 'pending' })));

    for (let i = 0; i < selected.length; i++) {
      const t = selected[i];
      setBatchProgress(prev => prev.map((p, j) => j === i ? { ...p, status: 'generating' } : p));
      try {
        const res  = await fetch('/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: t, audience: batchAudience, niche: batchNiche, tone: batchTone, template: batchTemplate, slide_count: batchSlideCount }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const slides: Slide[] = data.slideshow.slides;
        const customs = defaultCustomizations(slides, t, batchTemplate);
        const id = uid();
        const sw: SavedSlideshow = {
          id, title: data.slideshow.title, template: batchTemplate,
          niche: batchNiche, tone: batchTone, slides,
          textCustomizations: customs, imageUrls: [],
          caption: data.slideshow.caption, hashtags: data.slideshow.hashtags,
          generatedAt: Date.now(),
        };
        upsertLibrary(sw);
        // fetch images in background, update library when ready
        fetchPhotosForSlides(slides).then(photos => {
          const urls = photos.map(p => p.imageUrl || p.previewUrl);
          const updatedCustoms = customs.map((c, j) => ({
            ...c, imageUrl: photos[j]?.imageUrl || '', previewUrl: photos[j]?.previewUrl || '',
          }));
          upsertLibrary({ ...sw, imageUrls: urls, textCustomizations: updatedCustoms });
        });
        setBatchProgress(prev => prev.map((p, j) => j === i ? { ...p, status: 'done' } : p));
      } catch {
        setBatchProgress(prev => prev.map((p, j) => j === i ? { ...p, status: 'error' } : p));
      }
    }
    setBatchGenerating(false);
    setBatchDone(true);
  }

  // ── Library editor: push to TikTok queue ──────────────────────────────
  async function pushLibraryItem() {
    const sw = library.find(s => s.id === libraryEditId);
    if (!sw) return;
    setLibPushing(true);
    setLibPushAt(null);
    setLibPushError('');
    try {
      const res = await fetch('/api/queue/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sw.title, template: sw.template, niche: sw.niche, tone: sw.tone,
          caption: sw.caption, hashtags: sw.hashtags,
          slides: sw.slides, textCustomizations: sw.textCustomizations,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLibPushAt(data.item.scheduled_at);
      setDownloadedIds(prev => new Set([...prev, sw.id]));
      fetchQueue();
    } catch (e: unknown) {
      setLibPushError(e instanceof Error ? e.message : 'Push failed');
    } finally {
      setLibPushing(false);
    }
  }

  // ── Queue helpers ──────────────────────────────────────────────────────
  async function fetchQueue() {
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      if (data.items) setQueueItems(data.items);
    } catch { /* non-fatal */ }
  }

  async function fetchQueueSettings() {
    try {
      const res = await fetch('/api/queue/settings');
      const data = await res.json();
      setQueueSettings(data);
      setEditPpd(data.posts_per_day);
      setEditTimes(data.post_times);
      setEditPhone(data.notify_phone ?? '+12035363028');
    } catch { /* non-fatal */ }
  }

  async function saveQueueSettings() {
    await fetch('/api/queue/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts_per_day: editPpd, post_times: editTimes, notify_phone: editPhone }),
    });
    setQueueSettings({ posts_per_day: editPpd, post_times: editTimes, notify_phone: editPhone });
    setSettingsEditing(false);
  }

  async function checkChrome() {
    const res = await fetch('/api/queue/chrome');
    const data = await res.json();
    setChromeConnected(data.connected);
  }

  async function launchChrome() {
    setChromeLaunching(true);
    const res = await fetch('/api/queue/chrome', { method: 'POST' });
    const data = await res.json();
    setChromeConnected(data.ok);
    setChromeLaunching(false);
  }

  async function removeQueueItem(id: number) {
    await fetch('/api/queue/item', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    fetchQueue();
  }

  async function retryQueueItem(id: number) {
    // Reset to pending with a new time 2 minutes from now so the worker picks it up immediately
    const soon = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    await fetch('/api/queue/item', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, scheduled_at: soon }),
    });
    await fetchQueue();
  }

  async function rescheduleQueueItem(id: number, dateStr: string, timeStr: string) {
    const iso = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    try {
      const res = await fetch('/api/queue/item', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, scheduled_at: iso }),
      });
      const data = await res.json();
      if (data.item) {
        // Immediately patch state so UI updates without waiting for full refetch
        setQueueItems(prev => prev.map(qi => qi.id === id ? { ...qi, scheduled_at: data.item.scheduled_at } : qi));
      }
    } catch (e) {
      console.error('[reschedule]', e);
    }
    await fetchQueue();
  }

  const editingSlideshow = libraryEditId ? library.find(s => s.id === libraryEditId) : null;

  // ── Queue: group items by LOCAL date ─────────────────────────────────
  function localDateKey(iso: string) {
    const d = new Date(iso);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  const queueByDay = queueItems.reduce<Record<string, QueueItem[]>>((acc, item) => {
    const day = localDateKey(item.scheduled_at);
    (acc[day] ??= []).push(item);
    return acc;
  }, {});

  function fmtTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return iso; }
  }
  function fmtDay(localKey: string) {
    try {
      // Compare using local midnight to avoid any UTC shift
      const [y, mo, d] = localKey.split('-').map(Number);
      const date  = new Date(y, mo - 1, d);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tom   = new Date(today); tom.setDate(today.getDate() + 1);
      if (date.getTime() === today.getTime()) return 'Today';
      if (date.getTime() === tom.getTime())   return 'Tomorrow';
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return localKey; }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">

      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="px-6 h-14 flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                <span className="text-white font-black text-xs">RF</span>
              </div>
              <span className="font-bold tracking-tight">ReelFarm</span>
              <span className="text-gray-400 text-[10px] border border-gray-200 rounded px-1.5 py-0.5">BETA</span>
            </div>
            {/* Tabs */}
            <nav className="flex gap-1 ml-4">
              {([
                ['create',  'Create'],
                ['batch',   'Batch Generate'],
                ['library', `Library${library.length > 0 ? ` (${library.length})` : ''}`],
                ['queue',   `Queue${queueItems.filter(i => i.status === 'pending').length > 0 ? ` (${queueItems.filter(i => i.status === 'pending').length})` : ''}`],
              ] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setActiveTab(key); if (key !== 'library') setLibraryEditId(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === key
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* ── CREATE TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <div className="flex flex-1 max-w-[1600px] mx-auto w-full px-6 py-6 gap-6">
          <aside className="w-[340px] flex-shrink-0">
            <div className="sticky top-20 space-y-5 pb-10">

              <section className="space-y-3">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Topic / Prompt</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest">Niche</label>
                    <select value={niche} onChange={e => setNiche(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                      <option value="">Any</option>
                      {NICHES.map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest">Tone</label>
                    <select value={tone} onChange={e => setTone(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                      <option value="">Any</option>
                      {TONES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest">Slides</label>
                    <select value={slideCount} onChange={e => setSlideCount(Number(e.target.value))}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                      {SLIDE_COUNTS.map(n => <option key={n} value={n}>{n} slides</option>)}
                    </select>
                  </div>
                </div>
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); }}}
                  placeholder="e.g. 5 signs you need to fix your sleep schedule"
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                />
                {genError && <p className="text-red-500 text-xs">{genError}</p>}
              </section>

              <section className="space-y-3">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Template</h2>
                <TemplatePicker value={template} onChange={setTemplate} />
              </section>

              <button onClick={generate} disabled={generating || !topic.trim()}
                className="w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {generating ? <><Spinner /> Generating…</> : '✦ Generate Slides'}
              </button>

              {slideshow && (
                <>
                  {/* Save to Queue */}
                  {pushScheduledAt ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
                      <p className="text-green-700 text-xs font-bold">✓ Saved to Queue</p>
                      <button onClick={pushCurrent} disabled={pushing} className="text-[10px] text-green-600 underline hover:text-green-800 mt-1">
                        Save Again
                      </button>
                    </div>
                  ) : (
                    <button onClick={pushCurrent} disabled={pushing}
                      className="w-full bg-black text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 hover:bg-gray-800 flex items-center justify-center gap-2">
                      {pushing ? <><Spinner /> Rendering…</> : '↓ Save to Queue'}
                    </button>
                  )}
                  {pushing && <p className="text-gray-400 text-xs text-center">Rendering 1080×1920 slides… ~30s</p>}
                  {pushError && <p className="text-red-500 text-xs">{pushError}</p>}

                  <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Caption</p>
                    <p className="text-gray-600 text-xs leading-relaxed">{slideshow.caption}</p>
                    <div className="flex flex-wrap gap-1">
                      {slideshow.hashtags.map(h => (
                        <span key={h} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{h}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <PreviewEditor
              slides={slideshow?.slides ?? []}
              imageUrls={imageUrls}
              textCustomizations={textCustomizations}
              onChange={(i, c) => setTextCustomizations(prev => { const n = [...prev]; n[i] = c; return n; })}
              loading={pushing}
            />
          </main>
        </div>
      )}

      {/* ── BATCH TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'batch' && (
        <div className="flex-1 max-w-[900px] mx-auto w-full px-6 py-8 space-y-8">

          {/* Config row */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-sm uppercase tracking-widest text-gray-500">1 — Configure</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Subject</label>
                <input
                  type="text"
                  value={batchSubject}
                  onChange={e => setBatchSubject(e.target.value)}
                  placeholder="e.g. back pain, morning routines…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Audience</label>
                <input
                  type="text"
                  value={batchAudience}
                  onChange={e => setBatchAudience(e.target.value)}
                  placeholder="e.g. woman, older man, teen girl…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Niche</label>
                <select value={batchNiche} onChange={e => setBatchNiche(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                  <option value="">Any</option>
                  {NICHES.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Tone</label>
                <select value={batchTone} onChange={e => setBatchTone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                  <option value="">Any</option>
                  {TONES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Template</label>
                <select value={batchTemplate} onChange={e => setBatchTemplate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                  {['Dark Cinematic','Moody Warm','Grain Noir','Winter Arc','Dark Academia','Organic Raw'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Slides</label>
                <select value={batchSlideCount} onChange={e => setBatchSlideCount(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                  {SLIDE_COUNTS.map(n => <option key={n} value={n}>{n} slides</option>)}
                </select>
              </div>
            </div>
            <button
              onClick={generateTopics}
              disabled={topicsLoading || (!batchSubject.trim() && !batchNiche && !batchTone)}
              className="bg-gray-900 text-white text-xs font-bold px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {topicsLoading ? <><Spinner cls="w-3.5 h-3.5" /> Generating topics…</> : '✦ Generate 10 Topics'}
            </button>
            {topicsError && <p className="text-red-500 text-xs">{topicsError}</p>}
          </section>

          {/* Topic selection */}
          {generatedTopics.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm uppercase tracking-widest text-gray-500">2 — Pick Topics</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedTopics(new Set(generatedTopics.map((_, i) => i)))}
                    className="text-xs text-gray-500 hover:text-gray-900 underline"
                  >Select all</button>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => setSelectedTopics(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-900 underline"
                  >Clear</button>
                </div>
              </div>
              <div className="space-y-2">
                {generatedTopics.map((t, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedTopics.has(i)
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTopics.has(i)}
                      onChange={() => {
                        setSelectedTopics(prev => {
                          const next = new Set(prev);
                          next.has(i) ? next.delete(i) : next.add(i);
                          return next;
                        });
                      }}
                      className="mt-0.5 flex-shrink-0 accent-white"
                    />
                    <span className="text-sm leading-snug">{t}</span>
                  </label>
                ))}
              </div>
              {selectedTopics.size > 0 && !batchGenerating && !batchDone && (
                <button
                  onClick={generateSelected}
                  className="w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  ✦ Generate {selectedTopics.size} Slideshow{selectedTopics.size !== 1 ? 's' : ''}
                </button>
              )}
            </section>
          )}

          {/* Progress */}
          {batchProgress.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <h2 className="font-bold text-sm uppercase tracking-widest text-gray-500">3 — Progress</h2>
              <div className="space-y-2">
                {batchProgress.map((p, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
                    p.status === 'done'       ? 'bg-green-50 border-green-200 text-green-800' :
                    p.status === 'generating' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                    p.status === 'error'      ? 'bg-red-50 border-red-200 text-red-800' :
                    'bg-gray-50 border-gray-200 text-gray-500'
                  }`}>
                    <span className="flex-shrink-0 w-5 text-center">
                      {p.status === 'done'       ? '✓' :
                       p.status === 'generating' ? <Spinner cls="w-3.5 h-3.5" /> :
                       p.status === 'error'      ? '✕' : '·'}
                    </span>
                    <span className="flex-1 leading-snug">{p.topic}</span>
                  </div>
                ))}
              </div>
              {batchDone && (
                <button
                  onClick={() => { setActiveTab('library'); setLibraryEditId(null); }}
                  className="w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-xl hover:bg-gray-800 transition-all"
                >
                  View in Library →
                </button>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── LIBRARY TAB ────────────────────────────────────────────────── */}
      {activeTab === 'library' && (
        <>
          {/* ── Library editor (single item) ── */}
          {editingSlideshow ? (
            <div className="flex flex-1 max-w-[1600px] mx-auto w-full px-6 py-6 gap-6">
              {/* Left sidebar */}
              <aside className="w-[280px] flex-shrink-0">
                <div className="sticky top-20 space-y-4 pb-10">
                  <button
                    onClick={() => setLibraryEditId(null)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    ← Back to Library
                  </button>

                  <div className="space-y-1">
                    <p className="font-bold text-sm leading-snug">{editingSlideshow.title}</p>
                    <p className="text-[10px] text-gray-400">{editingSlideshow.template} · {editingSlideshow.slides.length} slides</p>
                  </div>

                  {/* Save to Queue */}
                  {libPushAt ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
                      <p className="text-green-700 text-xs font-bold">✓ Saved to Queue</p>
                      <button onClick={pushLibraryItem} disabled={libPushing} className="text-[10px] text-green-600 underline hover:text-green-800 mt-1">
                        Save Again
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={pushLibraryItem}
                      disabled={libPushing}
                      className="w-full bg-black text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 hover:bg-gray-800 flex items-center justify-center gap-2"
                    >
                      {libPushing ? <><Spinner /> Rendering…</> : '↓ Save to Queue'}
                    </button>
                  )}
                  {libPushing && <p className="text-gray-400 text-xs text-center">Rendering 1080×1920… ~30s</p>}
                  {libPushError && <p className="text-red-500 text-xs">{libPushError}</p>}

                  {editingSlideshow.caption && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest">Caption</p>
                      <p className="text-gray-600 text-xs leading-relaxed">{editingSlideshow.caption}</p>
                      <div className="flex flex-wrap gap-1">
                        {editingSlideshow.hashtags.map(h => (
                          <span key={h} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </aside>

              {/* Editor */}
              <main className="flex-1 min-w-0">
                <PreviewEditor
                  slides={editingSlideshow.slides}
                  imageUrls={
                    // Prefer saved imageUrls array; fall back to imageUrl stored per-customization
                    editingSlideshow.imageUrls.length > 0
                      ? editingSlideshow.imageUrls
                      : editingSlideshow.textCustomizations.map(c => c.imageUrl || c.previewUrl || '')
                  }
                  textCustomizations={editingSlideshow.textCustomizations}
                  onChange={(i, c) => {
                    setLibrary(prev => prev.map(sw => {
                      if (sw.id !== editingSlideshow.id) return sw;
                      const nextCustoms = [...sw.textCustomizations];
                      nextCustoms[i] = c;
                      // Keep imageUrls array in sync with per-slide imageUrl fields
                      const nextImageUrls = sw.textCustomizations.map((existing, j) =>
                        j === i ? (c.imageUrl || c.previewUrl || sw.imageUrls[j] || '') : (sw.imageUrls[j] || existing.imageUrl || existing.previewUrl || '')
                      );
                      return { ...sw, textCustomizations: nextCustoms, imageUrls: nextImageUrls };
                    }));
                  }}
                />
              </main>
            </div>
          ) : (
            /* ── Library grid ── */
            <div className="flex-1 max-w-[1200px] mx-auto w-full px-6 py-8">
              {library.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
                  <div className="text-5xl opacity-20">📚</div>
                  <p className="text-gray-400 text-sm">No slideshows yet — generate some in Create or Batch.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveTab('create')} className="bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-800">
                      Create One
                    </button>
                    <button onClick={() => setActiveTab('batch')} className="bg-gray-100 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-200">
                      Batch Generate
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-bold text-lg">{library.length} Slideshow{library.length !== 1 ? 's' : ''}</h2>
                    <button
                      onClick={() => {
                        if (confirm('Clear all slideshows from the library? This cannot be undone.')) {
                          setLibrary([]);
                          setDownloadedIds(new Set());
                        }
                      }}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Clear Library
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {library.map(sw => {
                      const thumb = sw.textCustomizations[0]?.imageUrl || sw.textCustomizations[0]?.previewUrl || sw.imageUrls[0];
                      return (
                        <div
                          key={sw.id}
                          className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-gray-400 transition-all group cursor-pointer"
                          onClick={() => openLibraryEditor(sw.id)}
                        >
                          {/* Thumbnail */}
                          <div className="aspect-[9/16] bg-gray-100 relative overflow-hidden">
                            {thumb
                              ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🎬</div>
                            }
                            {/* Downloaded badge */}
                            {downloadedIds.has(sw.id) && (
                              <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center pointer-events-none">
                                <div className="bg-green-500 rounded-full w-10 h-10 flex items-center justify-center shadow-lg">
                                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-lg transition-opacity">
                                Edit
                              </span>
                            </div>
                            <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                              {sw.slides.length}s
                            </div>
                          </div>
                          {/* Info */}
                          <div className="p-3 space-y-1">
                            <p className="font-semibold text-xs leading-snug line-clamp-2">{sw.title}</p>
                            <p className="text-[10px] text-gray-400">{sw.template}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── QUEUE TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (() => {
        const ready = queueItems.filter(i => i.status === 'pending' || i.status === 'failed');
        const done  = queueItems.filter(i => i.status === 'posted');
        const activeList = queueSubTab === 'ready' ? ready : done;
        return (
          <div className="flex-1 w-full bg-white">
            <div className="max-w-[800px] mx-auto px-8 py-10 space-y-6">

              {/* ── Sub-tabs ── */}
              <div className="flex items-center gap-1 p-1 rounded-xl w-fit bg-gray-100 border border-gray-200">
                {(['ready', 'downloaded'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setQueueSubTab(tab)}
                    className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
                    style={queueSubTab === tab
                      ? { background: '#fff', color: '#000', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                      : { color: '#9ca3af' }}
                  >
                    {tab === 'ready' ? `Ready${ready.length > 0 ? ` (${ready.length})` : ''}` : `Downloaded${done.length > 0 ? ` (${done.length})` : ''}`}
                  </button>
                ))}
              </div>

              {/* ── Download All button (ready tab only) ── */}
              {queueSubTab === 'ready' && (
                <button
                  disabled={ready.length === 0}
                  onClick={async () => {
                    const res = await fetch('/api/queue/download', { method: 'POST' });
                    const data = await res.json();
                    if (data.error) alert(data.error);
                    else { fetchQueue(); setQueueSubTab('downloaded'); }
                  }}
                  className="w-full bg-black text-white font-bold text-base py-4 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  ↓ Download All Slideshows
                </button>
              )}

              {/* ── List ── */}
              {activeList.length > 0 ? (
                <div className="space-y-2">
                  {activeList.map(item => (
                    <div key={item.id} className="rounded-xl px-4 py-3.5 flex items-center gap-4 group bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${queueSubTab === 'downloaded' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">{item.title}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {item.slide_paths.length} slides{item.caption ? ` · ${item.caption}` : ''}
                        </p>
                      </div>
                      <button onClick={() => removeQueueItem(item.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none opacity-0 group-hover:opacity-100 flex-shrink-0"
                        title="Remove">×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl p-16 text-center space-y-4 border border-gray-200">
                  <p className="text-5xl opacity-10">↓</p>
                  {queueSubTab === 'ready' ? (
                    <>
                      <p className="text-gray-400 text-sm">No slideshows queued yet.</p>
                      <button onClick={() => setActiveTab('library')}
                        className="text-xs text-gray-400 hover:text-black transition-colors underline underline-offset-2">
                        Go to Library →
                      </button>
                    </>
                  ) : (
                    <p className="text-gray-400 text-sm">Nothing downloaded yet.</p>
                  )}
                </div>
              )}

            </div>
          </div>
        );
      })()}
    </div>
  );
}
