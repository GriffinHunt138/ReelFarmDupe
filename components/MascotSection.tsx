'use client';

import { useState, useEffect, useRef } from 'react';
import StabilityRock from '@/components/StabilityRock';
import StabilityPreviewEditor, { type StabilitySlideEntry } from '@/components/StabilityPreviewEditor';
import { defaultStabilityCustomization } from '@/components/StabilitySlideEditorCard';
import { stripHtmlForSvg } from '@/lib/stability/slide-svg';
import type { RockMood } from '@/components/StabilityRock';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScriptScene {
  text: string;
  duration: number;
  mood: RockMood;
  slide_chip?: string;
  slide_headline: string;
  slide_body?: string;
  slide_accent?: string;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'scripting' | 'audio' | 'video' | 'compositing' | 'done' | 'error';
  step: string | null;
  progress: number;
  error: string | null;
  videoReady: boolean;
  script: { title: string; hashtags: string[]; scenes: ScriptScene[] } | null;
}

type Step = 'editing' | 'rendering' | 'done' | 'error';

const SLIDE_COUNTS = [2, 3, 4, 5, 6, 7, 8];

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Initial placeholder slides ───────────────────────────────────────────────

function makePlaceholders(n: number): StabilitySlideEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: uid(),
    custom: defaultStabilityCustomization({ headline: `Slide ${i + 1}` }),
  }));
}

const INITIAL_SLIDES: StabilitySlideEntry[] = [
  {
    id: uid(),
    custom: defaultStabilityCustomization({
      chip: 'THE PROBLEM', headline: 'Your back hurts for a reason',
      body: 'Sitting all day crushes your discs and kills blood flow.', accent: '8 hrs/day sitting',
    }),
  },
  {
    id: uid(),
    custom: defaultStabilityCustomization({
      chip: 'THE FIX', headline: 'Do these 3 stretches daily', body: '', accent: '',
    }),
  },
  {
    id: uid(),
    custom: defaultStabilityCustomization({
      chip: 'DO THIS', headline: 'Start tomorrow morning',
      body: 'Five minutes. Every day. Your spine will thank you.', accent: '',
    }),
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ cls = 'w-4 h-4' }: { cls?: string }) {
  return (
    <svg className={`${cls} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${value}%` }}/>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MascotSection() {
  // ── Slide state ────────────────────────────────────────────────────────────
  const [slides,    setSlides]    = useState<StabilitySlideEntry[]>(INITIAL_SLIDES);
  const [step,      setStep]      = useState<Step>('editing');
  const [jobId,     setJobId]     = useState<string | null>(null);
  const [job,       setJob]       = useState<JobStatus | null>(null);
  const [submitErr, setSubmitErr] = useState('');

  // ── Prompt-based generation state ─────────────────────────────────────────
  const [topic,        setTopic]        = useState('');
  const [slideCount,   setSlideCount]   = useState(5);
  const [genLoading,   setGenLoading]   = useState(false);
  const [genError,     setGenError]     = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rockMood: RockMood = (() => {
    if (genLoading) return 'thinking';
    if (step === 'editing') return 'idle';
    if (!job) return 'thinking';
    if (job.status === 'error')     return 'concerned';
    if (job.status === 'done')      return 'excited';
    if (job.status === 'scripting') return 'thinking';
    return 'talking';
  })();

  useEffect(() => {
    if (!jobId || step !== 'rendering') return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetch(`/api/stability/status/${jobId}`).then(r => r.json()) as JobStatus;
        setJob(data);
        if (data.status === 'done')  { setStep('done');  clearInterval(pollRef.current!); }
        if (data.status === 'error') { setStep('error'); clearInterval(pollRef.current!); }
      } catch { /* non-fatal */ }
    }, 3_000);
    return () => clearInterval(pollRef.current!);
  }, [jobId, step]);

  // ── Prompt generation ──────────────────────────────────────────────────────

  async function generateSlides() {
    if (!topic.trim()) return;
    setGenLoading(true);
    setGenError('');
    // Show placeholder slides while generating
    setSlides(makePlaceholders(slideCount));
    try {
      const res  = await fetch('/api/stability/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), slideCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const generated: StabilitySlideEntry[] = (data.slides as Array<{
        chip?: string; headline: string; body?: string; accent?: string;
      }>).map(s => ({
        id: uid(),
        custom: defaultStabilityCustomization({
          chip: s.chip, headline: s.headline, body: s.body ?? '', accent: s.accent ?? '',
        }),
      }));
      setSlides(generated);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate slides');
      setSlides(INITIAL_SLIDES); // reset to defaults on error
    } finally {
      setGenLoading(false);
    }
  }

  // ── Slide CRUD ─────────────────────────────────────────────────────────────

  function addSlide() {
    setSlides(s => [...s, { id: uid(), custom: defaultStabilityCustomization({ headline: 'New slide' }) }]);
  }
  function updateSlide(id: string, custom: StabilitySlideEntry['custom']) {
    setSlides(s => s.map(sl => sl.id === id ? { ...sl, custom } : sl));
  }
  function deleteSlide(id: string) {
    setSlides(s => s.filter(sl => sl.id !== id));
  }
  function moveSlide(id: string, dir: -1 | 1) {
    setSlides(s => {
      const i = s.findIndex(sl => sl.id === id);
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const a = [...s]; [a[i], a[j]] = [a[j], a[i]]; return a;
    });
  }

  // ── Video generation ───────────────────────────────────────────────────────

  async function generateVideo() {
    const valid = slides.filter(s => stripHtmlForSvg(s.custom.hlHtml).trim());
    if (!valid.length) return;
    setSubmitErr('');
    setStep('rendering');
    setJob(null);
    try {
      const res = await fetch('/api/stability/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDuration: 45,
          slides: valid.map(({ custom: c }) => ({
            chip:        stripHtmlForSvg(c.chipHtml)   || undefined,
            headline:    stripHtmlForSvg(c.hlHtml),
            body:        stripHtmlForSvg(c.bodyHtml)   || undefined,
            accent:      stripHtmlForSvg(c.accentHtml) || undefined,
            chipPos:     c.chipHtml   ? { x: c.chipX,   y: c.chipY   } : undefined,
            headlinePos: { x: c.hlX,   y: c.hlY   },
            bodyPos:     c.bodyHtml   ? { x: c.bodyX,   y: c.bodyY   } : undefined,
            accentPos:   c.accentHtml ? { x: c.accentX, y: c.accentY } : undefined,
            rockyPos:    { x: c.rockyX, y: c.rockyY },
            hlFont:      c.hlFont,
            hlFontSize:  c.hlFontSize,
            hlWidth:     c.hlWidth,
            bodyFont:    c.bodyFont,
            bodyFontSize: c.bodyFontSize,
            bodyWidth:   c.bodyWidth,
            imageDataUrl: c.imageDataUrl || undefined,
            imageX:      c.imageDataUrl ? c.imageX : undefined,
            imageY:      c.imageDataUrl ? c.imageY : undefined,
            imageW:      c.imageDataUrl ? c.imageW : undefined,
            imageH:      c.imageDataUrl ? c.imageH : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobId(data.jobId);
      setJob({ id: data.jobId, status: 'pending', step: 'Starting…', progress: 0,
               error: null, videoReady: false, script: null });
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : 'Failed to start');
      setStep('editing');
    }
  }

  const canGenerate = slides.some(s => stripHtmlForSvg(s.custom.hlHtml).trim());
  const isRunning   = step === 'rendering';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#080c14] text-white">

      {/* Section header */}
      <div className="px-6 py-3.5 border-b border-white/8 bg-[#080c14] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <StabilityRock mood={rockMood} size={22} animate={isRunning || genLoading}/>
          <div>
            <h1 className="font-bold text-sm">Mascot Videos</h1>
            <p className="text-[10px] text-white/30">Rocky narrates your slides · ~45s video</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && job && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Spinner cls="w-3.5 h-3.5"/>
              <span>{job.step ?? 'Working…'}</span>
              <span className="text-white/20">{job.progress}%</span>
            </div>
          )}
          {(step === 'rendering' || step === 'done' || step === 'error') && (
            <button
              onClick={() => { setStep('editing'); setJob(null); setJobId(null); }}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              ← Edit slides
            </button>
          )}
        </div>
      </div>

      {/* ── EDITING ──────────────────────────────────────────────────────────── */}
      {step === 'editing' && (
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar — generate from prompt */}
          <div className="w-[220px] flex-shrink-0 border-r border-white/8 overflow-y-auto flex flex-col">
            <div className="p-4 space-y-4 flex-1">

              {/* Prompt input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Topic
                </label>
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateSlides(); }}}
                  placeholder="e.g. why your lower back hurts when sitting"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              {/* Slide count */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Slides
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SLIDE_COUNTS.map(n => (
                    <button
                      key={n}
                      onClick={() => setSlideCount(n)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        slideCount === n
                          ? 'bg-white text-gray-900'
                          : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/20">
                  ~{Math.round(45 / slideCount)}s per slide
                </p>
              </div>

              {/* Generate slides button */}
              {genError && <p className="text-red-400 text-[10px]">{genError}</p>}
              <button
                onClick={generateSlides}
                disabled={genLoading || !topic.trim()}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-2.5 rounded-xl transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
              >
                {genLoading ? <><Spinner cls="w-3.5 h-3.5"/>Generating…</> : '✦ Generate Slides'}
              </button>

              {/* Divider */}
              <div className="border-t border-white/8"/>

              {/* Rocky */}
              <div className="flex flex-col items-center gap-2 pt-1">
                <StabilityRock mood={rockMood} size={90} animate/>
                <p className="text-[9px] text-white/20 text-center leading-snug">
                  Click a slide to edit.<br/>Drag handles to reposition.
                </p>
              </div>

            </div>

            {/* Generate video button — pinned to bottom */}
            <div className="p-4 border-t border-white/8 space-y-2">
              {submitErr && <p className="text-red-400 text-[10px] text-center">{submitErr}</p>}
              <button
                onClick={generateVideo}
                disabled={!canGenerate || genLoading}
                className="w-full bg-white text-gray-900 font-bold text-xs py-2.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
              >
                ▶ Generate Video
              </button>
              <p className="text-[9px] text-white/15 text-center">~45s · ~90s render</p>
            </div>
          </div>

          {/* Main — slide editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {genLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Spinner cls="w-8 h-8 text-white/30"/>
                <p className="text-sm text-white/40">Generating {slideCount} slides…</p>
              </div>
            ) : (
              <StabilityPreviewEditor
                slides={slides}
                onChange={updateSlide}
                onAdd={addSlide}
                onDelete={deleteSlide}
                onMove={moveSlide}
              />
            )}
          </div>
        </div>
      )}

      {/* ── RENDERING / DONE / ERROR ─────────────────────────────────────────── */}
      {(step === 'rendering' || step === 'done' || step === 'error') && (
        <div className="flex flex-1 overflow-hidden">

          {/* Rocky + progress */}
          <div className="w-[200px] flex-shrink-0 border-r border-white/8 flex flex-col items-center gap-5 p-6">
            <StabilityRock mood={rockMood} size={140} animate={step !== 'done'}/>

            {isRunning && job && (
              <div className="w-full space-y-2">
                <p className="text-[11px] text-white/50 text-center">{job.step ?? 'Working…'}</p>
                <ProgressBar value={job.progress}/>
                <p className="text-[10px] text-white/30 text-center">{job.progress}%</p>
              </div>
            )}

            {step === 'done' && (
              <button
                onClick={() => { setStep('editing'); setJob(null); setJobId(null); }}
                className="w-full bg-white/10 text-white text-xs font-bold py-2 rounded-xl hover:bg-white/20 transition-colors"
              >
                ← Edit slides
              </button>
            )}
          </div>

          {/* Script + video */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {job?.script && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm">{job.script.title}</h2>
                  <p className="text-[10px] text-white/30">
                    {job.script.hashtags.map(h => `#${h}`).join(' ')}
                  </p>
                </div>
                <div className="space-y-2">
                  {job.script.scenes.map((scene, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
                      <StabilityRock mood={scene.mood} size={28}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-white/30">SLIDE {i + 1}</span>
                          {scene.slide_chip && (
                            <span className="text-[9px] text-[#5ce1ff] bg-[#1a2744] rounded-full px-1.5 py-0.5">
                              {scene.slide_chip}
                            </span>
                          )}
                          <span className="text-[10px] text-white/20">~{scene.duration}s</span>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed italic">"{scene.text}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isRunning && !job?.script && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-3">
                <Spinner cls="w-7 h-7 text-white/30"/>
                <p className="text-sm text-white/40">{job?.step ?? 'Working…'}</p>
              </div>
            )}

            {step === 'done' && job?.videoReady && (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <video
                  src={`/api/stability/video/${job.id}`}
                  controls playsInline
                  className="w-full rounded-t-2xl"
                  style={{ maxHeight: 520 }}
                />
                <div className="p-4">
                  <a
                    href={`/api/stability/video/${job.id}`}
                    download="rocky-video.mp4"
                    className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-lg hover:bg-white/90 transition-colors inline-block"
                  >
                    ↓ Download MP4
                  </a>
                </div>
              </div>
            )}

            {step === 'done' && !job?.videoReady && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center text-sm text-white/50">
                Done — <a href={`/api/stability/video/${jobId}`} className="underline">open video</a>
              </div>
            )}

            {step === 'error' && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-5 space-y-2">
                <p className="text-red-400 text-sm font-bold">Generation failed</p>
                <p className="text-red-400/70 text-xs font-mono">{job?.error}</p>
                <button
                  onClick={() => { setStep('editing'); setJob(null); setJobId(null); }}
                  className="text-xs text-red-400/60 underline hover:text-red-400"
                >
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
