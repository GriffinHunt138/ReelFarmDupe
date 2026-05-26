'use client';

import { useState, useEffect, useRef } from 'react';
import StabilityRock from '@/components/StabilityRock';
import StabilityPreviewEditor, { type StabilitySlideEntry } from '@/components/StabilityPreviewEditor';
import { defaultStabilityCustomization } from '@/components/StabilitySlideEditorCard';
import { stripHtmlForSvg } from '@/lib/stability/slide-svg';
import type { RockMood, RockCostume } from '@/components/StabilityRock';
import { randomCostume } from '@/components/StabilityRock';

// ─── Types ──────────────────────────────────────────────────────────────────

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

function uid() { return Math.random().toString(36).slice(2, 9); }

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

// ─── Initial slides ──────────────────────────────────────────────────────────

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StabilityPage() {
  const [slides,           setSlides]           = useState<StabilitySlideEntry[]>(INITIAL_SLIDES);
  const [step,             setStep]             = useState<Step>('editing');
  const [jobId,            setJobId]            = useState<string | null>(null);
  const [job,              setJob]              = useState<JobStatus | null>(null);
  const [submitErr,        setSubmitErr]        = useState('');
  const [editedTexts,      setEditedTexts]      = useState<string[]>([]);
  const [scriptInitialised, setScriptInitialised] = useState(false);
  const [costume,          setCostume]          = useState<RockCostume>('plain');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rockMood: RockMood = (() => {
    if (step === 'editing') return 'idle';
    if (!job) return 'thinking';
    if (job.status === 'error')     return 'concerned';
    if (job.status === 'done')      return 'excited';
    if (job.status === 'scripting') return 'thinking';
    return 'talking';
  })();

  // Initialise editable script texts once — only on first script arrival
  useEffect(() => {
    if (!job?.script || scriptInitialised) return;
    setEditedTexts(job.script.scenes.map(s => s.text));
    setScriptInitialised(true);
  }, [job?.script, scriptInitialised]);

  // Reset when a new job starts
  useEffect(() => {
    if (step === 'editing') { setScriptInitialised(false); setEditedTexts([]); }
  }, [step]);

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

  // ── Slide actions ─────────────────────────────────────────────────────────

  function addSlide() {
    setSlides(s => [...s, {
      id: uid(),
      custom: defaultStabilityCustomization({ headline: 'New slide' }),
    }]);
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

  // ── Generate ─────────────────────────────────────────────────────────────

  async function generate() {
    const validSlides = slides.filter(s => stripHtmlForSvg(s.custom.hlHtml).trim());
    if (!validSlides.length) return;
    setCostume(randomCostume());   // fresh look for each video
    setSubmitErr('');
    setStep('rendering');
    setJob(null);
    try {
      const res = await fetch('/api/stability/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: validSlides.map(({ custom: c }) => ({
            chip:     stripHtmlForSvg(c.chipHtml)   || undefined,
            headline: stripHtmlForSvg(c.hlHtml),
            body:     stripHtmlForSvg(c.bodyHtml)   || undefined,
            accent:   stripHtmlForSvg(c.accentHtml) || undefined,
            chipPos:     c.chipHtml   ? { x: c.chipX,   y: c.chipY   } : undefined,
            headlinePos: { x: c.hlX,     y: c.hlY     },
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080c14]">

      {/* Header */}
      <header className="border-b border-white/8 bg-[#080c14] sticky top-0 z-50">
        <div className="px-6 h-14 flex items-center gap-4 max-w-[1400px] mx-auto">
          <a href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">← Faceless</a>
          <div className="flex items-center gap-2">
            <StabilityRock mood="idle" size={28}/>
            <span className="font-bold tracking-tight text-sm text-white">Stability Rock</span>
            <span className="text-white/30 text-[10px] border border-white/10 rounded px-1.5 py-0.5">VIDEO</span>
          </div>
          {step !== 'editing' && (
            <button onClick={() => { setStep('editing'); setJob(null); setJobId(null); }}
              className="ml-auto text-xs text-white/30 hover:text-white/60">
              ← Edit slides
            </button>
          )}
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* ── EDITING ─────────────────────────────────────────────────────── */}
        {step === 'editing' && (
          <div className="flex gap-8 items-start">

            {/* Slide editor — full width */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h1 className="font-bold text-white text-base">Build your slides</h1>
                <span className="text-xs text-white/30">{slides.length} slide{slides.length !== 1 ? 's' : ''}</span>
              </div>

              <StabilityPreviewEditor
                slides={slides}
                onChange={updateSlide}
                onAdd={addSlide}
                onDelete={deleteSlide}
                onMove={moveSlide}
                costume={costume}
              />
            </div>

            {/* Sidebar */}
            <div className="w-[200px] flex-shrink-0 sticky top-20 space-y-5">
              <div className="flex flex-col items-center gap-2">
                <StabilityRock mood={rockMood} costume={costume} size={120} animate/>
                {/* Costume badge + reroll */}
                {costume !== 'plain' && (
                  <span className="text-[10px] text-white/40 bg-white/6 border border-white/10 rounded-full px-2 py-0.5 capitalize">
                    {costume === 'tophat' ? 'Top Hat' : costume === 'sunglasses' ? 'Shades' : costume.charAt(0).toUpperCase() + costume.slice(1)} Rocky
                  </span>
                )}
                <button
                  onClick={() => setCostume(randomCostume())}
                  className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
                  title="Randomise Rocky's look"
                >
                  🎲 reroll look
                </button>
                <p className="text-xs text-white/30 text-center leading-snug">
                  Click any slide to edit.<br/>Drag handles to reposition.
                </p>
              </div>

              {submitErr && <p className="text-red-400 text-xs text-center">{submitErr}</p>}

              <button
                onClick={generate}
                disabled={!canGenerate}
                className="w-full bg-white text-gray-900 font-bold text-sm py-3 rounded-xl hover:bg-white/90 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                ▶ Generate Video
              </button>

              <p className="text-[10px] text-white/20 text-center">
                Rocky narrates each slide → ~90s render
              </p>
            </div>
          </div>
        )}

        {/* ── RENDERING / DONE ────────────────────────────────────────────── */}
        {(step === 'rendering' || step === 'done' || step === 'error') && (
          <div className="flex gap-10 items-start">

            {/* Rocky + progress */}
            <div className="flex flex-col items-center gap-5 w-[220px] flex-shrink-0 sticky top-20">
              <StabilityRock mood={rockMood} costume={costume} size={160} animate={step !== 'done'}/>

              {isRunning && job && (
                <div className="w-full space-y-2">
                  <p className="text-xs text-white/50 text-center">{job.step ?? 'Working…'}</p>
                  <ProgressBar value={job.progress}/>
                  <p className="text-[10px] text-white/30 text-center">{job.progress}%</p>
                </div>
              )}

              {step === 'done' && (
                <button onClick={() => { setStep('editing'); setJob(null); setJobId(null); }}
                  className="w-full bg-white/10 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-white/20 transition-colors">
                  ← Edit slides
                </button>
              )}
            </div>

            {/* Script + video */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Script preview */}
              {job?.script && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm text-white">{job.script.title}</h2>
                    <p className="text-[10px] text-white/30">
                      {job.script.hashtags.map(h => `#${h}`).join(' ')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {job.script.scenes.map((scene, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
                        <StabilityRock mood={scene.mood} costume={costume} size={32}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-white/30">SLIDE {i + 1}</span>
                            {scene.slide_chip && (
                              <span className="text-[9px] text-[#5ce1ff] bg-[#1a2744] rounded-full px-1.5 py-0.5">{scene.slide_chip}</span>
                            )}
                            <span className="text-[10px] text-white/20">~{scene.duration}s</span>
                          </div>
                          <textarea
                            value={editedTexts[i] ?? scene.text}
                            onChange={e => setEditedTexts(prev => {
                              const next = [...prev];
                              next[i] = e.target.value;
                              return next;
                            })}
                            onKeyDown={e => e.stopPropagation()}
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 leading-relaxed resize-none focus:outline-none focus:border-white/30 placeholder-white/20"
                            placeholder="Narration text…"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spinner before script */}
              {isRunning && !job?.script && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-3">
                  <Spinner cls="w-7 h-7 text-white/30"/>
                  <p className="text-sm text-white/40">{job?.step ?? 'Working…'}</p>
                </div>
              )}

              {/* Video */}
              {step === 'done' && job?.videoReady && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <video src={`/api/stability/video/${job.id}`} controls playsInline
                    className="w-full rounded-t-2xl" style={{ maxHeight: 560 }}/>
                  <div className="p-4">
                    <a href={`/api/stability/video/${job.id}`} download="rocky-video.mp4"
                      className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-lg hover:bg-white/90 transition-colors inline-block">
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

              {/* Error */}
              {step === 'error' && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-5 space-y-2">
                  <p className="text-red-400 text-sm font-bold">Generation failed</p>
                  <p className="text-red-400/70 text-xs font-mono">{job?.error}</p>
                  <button onClick={() => { setStep('editing'); setJob(null); setJobId(null); }}
                    className="text-xs text-red-400/60 underline hover:text-red-400">← Back</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
