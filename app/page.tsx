'use client';

import { useState, useEffect } from 'react';
import TemplatePicker from '@/components/TemplatePicker';
import PreviewEditor, { TextCustomization, TextStyle } from '@/components/PreviewEditor';
import TikTokConnect from '@/components/TikTokConnect';
import ExportPanel from '@/components/ExportPanel';

const NICHES = ['Fitness', 'Mindset', 'Finance', 'Beauty', 'Travel', 'Food', 'Tech', 'Fashion', 'Health', 'Motivation', 'Business', 'Gaming'];
const TONES  = ['Inspirational', 'Dark & Moody', 'Hype / Energy', 'Calm & Aesthetic', 'Educational', 'Shocking / Bold', 'Cinematic'];
const SLIDE_COUNTS = [3, 4, 5, 6, 7, 8, 10];

interface Slide {
  headline: string;
  body?: string | null;
  image_search: string;
  overlay_style: string;
  animation_hint?: string;
}

interface Slideshow {
  title: string;
  caption: string;
  hashtags: string[];
  slides: Slide[];
}

export default function Home() {
  const [topic,      setTopic]      = useState('');
  const [niche,      setNiche]      = useState('');
  const [tone,       setTone]       = useState('');
  const [template,   setTemplate]   = useState('Dark Cinematic');
  const [slideCount, setSlideCount] = useState(5);

  const [slideshow,  setSlideshow]  = useState<Slideshow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState('');

  const [downloading,  setDownloading]  = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [savedZipPath, setSavedZipPath] = useState<string | null>(null);
  const [postId,       setPostId]       = useState<number | null>(null);
  const [outputDir,    setOutputDir]    = useState<string | null>(null);
  const [slidePaths,   setSlidePaths]   = useState<string[]>([]);
  const [renderError,  setRenderError]  = useState('');

  const [imageUrls,          setImageUrls]          = useState<string[]>([]);
  const [textCustomizations, setTextCustomizations] = useState<TextCustomization[]>([]);
  const [tiktokConnected,    setTiktokConnected]    = useState(false);
  const [ideaLoading,        setIdeaLoading]        = useState(false);
  const [showExport,         setShowExport]         = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tiktok_connected')) { setTiktokConnected(true); window.history.replaceState({}, '', '/'); }
    if (params.get('tiktok_error'))     { window.history.replaceState({}, '', '/'); }
  }, []);

  async function generateIdea() {
    if (!niche && !tone) return;
    setIdeaLoading(true);
    try {
      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: `Create a viral ${niche || 'lifestyle'} TikTok idea with a ${tone || 'engaging'} tone`, niche, tone, template, slide_count: slideCount }),
      });
      const data = await res.json();
      if (data.slideshow?.title) setTopic(data.slideshow.title);
    } catch { /* non-fatal */ }
    finally { setIdeaLoading(false); }
  }

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setGenError('');
    setImageUrls([]);
    setPostId(null);
    setShowExport(false);
    setDownloadDone(false);
    setSavedZipPath(null);

    try {
      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, niche, tone, template, slide_count: slideCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSlideshow(data.slideshow);

      const isOrganic = template === 'Organic Raw';
      setTextCustomizations(
        (data.slideshow.slides as Slide[]).map((s, i) => ({
          headlineHtml: i === 0 ? topic : s.headline,
          bodyHtml:     s.body ?? '',
          // Organic Raw: text centred in the middle of the frame with
          // breathing room between headline and body (matches screenshot).
          // Other templates: headline higher, body below.
          hlX:   50,
          hlY:   isOrganic ? 38 : (i === 0 ? 30 : 28),
          bodyX: 50,
          bodyY: isOrganic ? 62 : (i === 0 ? 58 : 60),
          // Organic Raw: white pill on headline, plain white body text.
          hlStyle:   (isOrganic ? 'white-bg' : 'default') as TextStyle,
          bodyStyle: 'default' as TextStyle,
          hlFont:   isOrganic ? 'montserrat' : 'bebas',
          bodyFont: isOrganic ? 'montserrat' : 'inter',
        }))
      );

      // Fetch Pinterest images and persist both preview + full URLs
      const slides = data.slideshow.slides as Slide[];
      Promise.all(
        slides.map(async (slide: Slide) => {
          try {
            const r    = await fetch(`/api/images?query=${encodeURIComponent(slide.image_search)}&mode=search&count=8`);
            const json = await r.json();
            const photos: { previewUrl?: string; url?: string }[] = json.photos ?? [];
            // Pick a random result so every generation feels fresh
            const photo = photos.length > 0
              ? photos[Math.floor(Math.random() * photos.length)]
              : null;
            return {
              previewUrl: (photo?.previewUrl as string) ?? '',
              imageUrl:   (photo?.url        as string) ?? '',
            };
          } catch { return { previewUrl: '', imageUrl: '' }; }
        })
      ).then(photos => {
        setImageUrls(photos.map(p => p.imageUrl || p.previewUrl));
        setTextCustomizations(prev => prev.map((c, i) => ({
          ...c,
          previewUrl: photos[i]?.previewUrl || c.previewUrl,
          imageUrl:   photos[i]?.imageUrl   || c.imageUrl,
        })));
      });

    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function downloadSlides() {
    if (!slideshow) return;
    setDownloading(true);
    setRenderError('');
    setDownloadDone(false);
    setSavedZipPath(null);

    try {
      // Step 1: render PNGs with Playwright
      const renderRes = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:              slideshow.title,
          template,
          niche,
          tone,
          caption:            slideshow.caption,
          hashtags:           slideshow.hashtags,
          slides:             slideshow.slides,
          textCustomizations,
        }),
      });
      const renderData = await renderRes.json();
      if (renderData.error) throw new Error(renderData.error);

      setPostId(renderData.post_id);
      setOutputDir(renderData.output_dir);
      setSlidePaths(renderData.slide_paths);
      setShowExport(true);

      // Step 2: zip the PNGs and save to ~/Desktop/slideshows/ (same as before)
      const zipRes = await fetch('/api/export/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slidePaths: renderData.slide_paths, title: slideshow.title }),
      });
      const zipData = await zipRes.json();
      if (zipData.error) throw new Error(zipData.error);

      setSavedZipPath(zipData.zipPath);
      setDownloadDone(true);
    } catch (e: unknown) {
      setRenderError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="px-6 h-16 flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <span className="text-white font-black text-sm">RF</span>
            </div>
            <span className="font-bold text-lg tracking-tight">ReelFarm</span>
            <span className="text-gray-400 text-xs border border-gray-200 rounded-md px-2 py-0.5">BETA</span>
          </div>
          <div className="w-72">
            <TikTokConnect onStatusChange={setTiktokConnected} />
          </div>
        </div>
      </header>

      {/* Two-panel body */}
      <div className="flex flex-1 max-w-[1600px] mx-auto w-full px-6 py-6 gap-6">

        {/* ── Left panel: controls ── */}
        <aside className="w-[360px] flex-shrink-0">
          <div className="sticky top-24 space-y-6 pb-10">

            {/* Step 1 */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-black">1</div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-600">Idea &amp; Topic</h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-widest">Niche</label>
                  <select value={niche} onChange={e => setNiche(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                    <option value="">Any</option>
                    {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-widest">Tone</label>
                  <select value={tone} onChange={e => setTone(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                    <option value="">Any</option>
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-widest">Slides</label>
                  <select value={slideCount} onChange={e => setSlideCount(Number(e.target.value))}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-gray-400">
                    {SLIDE_COUNTS.map(n => <option key={n} value={n}>{n} slides</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={generateIdea} disabled={ideaLoading || (!niche && !tone)}
                    className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-500 hover:text-gray-900 text-xs font-medium px-3 py-2 rounded-lg transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                    {ideaLoading
                      ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      : <span>✨</span>}
                    Spark Idea
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Topic / Prompt</label>
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); }}}
                  placeholder="e.g. 5 signs you need to fix your sleep schedule"
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                />
                {genError && <p className="text-red-500 text-xs">{genError}</p>}
              </div>
            </section>

            {/* Step 2 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-black">2</div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-600">Template</h2>
              </div>
              <TemplatePicker value={template} onChange={setTemplate} />
            </section>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={generating || !topic.trim()}
              className="w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Generating…
                </>
              ) : '✦ Generate Slides'}
            </button>

            {/* Download button */}
            {slideshow && (
              <button
                onClick={downloadSlides}
                disabled={downloading}
                className="w-full bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Rendering…
                  </>
                ) : downloadDone ? '✓ Download Again' : '⬇ Download Slides'}
              </button>
            )}

            {downloading && (
              <p className="text-gray-400 text-xs text-center">Rendering 1080×1920 slides… ~30s</p>
            )}
            {downloadDone && savedZipPath && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-green-700 text-xs font-medium">✓ Saved to Desktop/slideshows/</p>
                <p className="text-green-600 text-[10px] mt-0.5 break-all opacity-70">{savedZipPath.split('/').slice(-1)[0]}</p>
              </div>
            )}
            {renderError && <p className="text-red-500 text-xs">{renderError}</p>}

            {/* Caption + hashtags */}
            {slideshow && (
              <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Caption</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{slideshow.caption}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {slideshow.hashtags.map(h => (
                    <span key={h} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{h}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Export */}
            {showExport && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-black">3</div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-600">Export &amp; Post</h2>
                </div>
                <ExportPanel
                  postId={postId}
                  outputDir={outputDir}
                  slidePaths={slidePaths}
                  previews={[]}
                  tiktokConnected={tiktokConnected}
                  title={slideshow?.title}
                />
              </div>
            )}
          </div>
        </aside>

        {/* ── Right panel: preview editor ── */}
        <main className="flex-1 min-w-0">
          <PreviewEditor
            slides={slideshow?.slides ?? []}
            imageUrls={imageUrls}
            textCustomizations={textCustomizations}
            onChange={(i, c) => setTextCustomizations(prev => {
              const next = [...prev];
              next[i] = c;
              return next;
            })}
            loading={downloading}
          />
        </main>
      </div>
    </div>
  );
}
