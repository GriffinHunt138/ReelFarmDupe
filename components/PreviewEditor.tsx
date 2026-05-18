'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { buildSlideHtml } from '@/lib/buildSlideHtml';
import PinterestSearchModal from './PinterestSearchModal';

export type TextStyle =
  | 'default' | 'outline' | 'white-text' | 'black-text' | 'yellow-text'
  | 'white-bg' | 'white-50-bg' | 'black-bg' | 'black-50-bg';

export type FontKey = 'bebas' | 'inter' | 'anton' | 'oswald' | 'playfair' | 'montserrat';

export interface TextCustomization {
  headlineHtml: string;
  bodyHtml: string;
  hlX: number; hlY: number;
  bodyX: number; bodyY: number;
  hlStyle: TextStyle;
  bodyStyle: TextStyle;
  hlFont?: FontKey;
  bodyFont?: FontKey;
  hlFontSize?: number;    // px — overrides auto-size when set
  bodyFontSize?: number;  // px — overrides default body size when set
  textBoxWidth?: number;  // px width for text blocks (default 780)
  imageUrl?: string;      // 736x Pinterest URL used for both preview AND export
  previewUrl?: string;    // 474x thumbnail (kept for backward compat, prefer imageUrl)
}

interface SlideData {
  headline: string;
  body?: string | null;
  image_search: string;
  overlay_style: string;
}

interface Props {
  slides: SlideData[];
  imageUrls: string[];            // preview URLs shown while loading
  textCustomizations: TextCustomization[];
  onChange: (index: number, c: TextCustomization) => void;
  loading?: boolean;
}

export const STYLE_OPTS: { value: TextStyle; label: string }[] = [
  { value: 'default',     label: 'Default'       },
  { value: 'outline',     label: 'Outline'       },
  { value: 'white-text',  label: 'White Text'    },
  { value: 'black-text',  label: 'Black Text'    },
  { value: 'yellow-text', label: 'Yellow Text'   },
  { value: 'white-bg',    label: 'White Pill'    },
  { value: 'white-50-bg', label: 'White 50% Pill'},
  { value: 'black-bg',    label: 'Black Pill'    },
  { value: 'black-50-bg', label: 'Black 50% Pill'},
];

export const FONT_OPTS: { value: FontKey; label: string }[] = [
  { value: 'bebas',       label: 'Bebas Neue'      },
  { value: 'inter',       label: 'Inter'           },
  { value: 'anton',       label: 'Anton'           },
  { value: 'oswald',      label: 'Oswald'          },
  { value: 'playfair',    label: 'Playfair Display'},
  { value: 'montserrat',  label: 'Montserrat'      },
];

// Scale: card width / actual slide width
const CARD_W = 220;
const SLIDE_W = 1080;
const SLIDE_H = 1920;
const SCALE   = CARD_W / SLIDE_W;            // ≈ 0.2037
const CARD_H  = Math.round(SLIDE_H * SCALE); // ≈ 390

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// ── Font size stepper ─────────────────────────────────────────────────────
function SizeStepper({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="px-1.5 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-bold transition-colors"
      >−</button>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="w-10 text-center text-xs text-gray-800 bg-transparent focus:outline-none tabular-nums py-1.5"
      />
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="px-1.5 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-bold transition-colors"
      >+</button>
    </div>
  );
}

// ── Drag handle — overlaid on top of iframe ────────────────────────────────
function DragHandle({
  x, y, label, color,
  onDragEnd,
}: {
  x: number; y: number;
  label: string;
  color: string;
  onDragEnd: (x: number, y: number) => void;
}) {
  const [live, setLive] = useState({ x, y });
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep live in sync when parent changes (e.g. after external update)
  useEffect(() => { if (!dragging.current) setLive({ x, y }); }, [x, y]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;

    const onMove = (ev: MouseEvent) => {
      const card = containerRef.current?.closest('[data-slide-card]') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      setLive({
        x: Math.max(5, Math.min(95, ((ev.clientX - r.left)  / r.width)  * 100)),
        y: Math.max(5, Math.min(95, ((ev.clientY - r.top)   / r.height) * 100)),
      });
    };

    const onUp = (ev: MouseEvent) => {
      dragging.current = false;
      const card = containerRef.current?.closest('[data-slide-card]') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const nx = Math.max(5, Math.min(95, ((ev.clientX - r.left)  / r.width)  * 100));
      const ny = Math.max(5, Math.min(95, ((ev.clientY - r.top)   / r.height) * 100));
      setLive({ x: nx, y: ny });
      onDragEnd(nx, ny);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [onDragEnd]);

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      className={`absolute z-30 w-5 h-5 ${color} rounded-full border-2 border-white shadow-lg
        cursor-move flex items-center justify-center text-white text-[7px] font-black select-none`}
      style={{ left: `${live.x}%`, top: `${live.y}%`, transform: 'translate(-50%,-50%)' }}
      title={`Drag to reposition ${label === 'H' ? 'headline' : 'body'}`}
    >
      {label}
    </div>
  );
}

// ── Single slide card ──────────────────────────────────────────────────────
function SlideCard({
  html, index, isActive,
  custom, hasBody,
  onActivate, onPositionChange, onImageClick,
}: {
  html: string;
  index: number;
  isActive: boolean;
  custom: TextCustomization;
  hasBody: boolean;
  onActivate: () => void;
  onPositionChange: (block: 'hl' | 'body', x: number, y: number) => void;
  onImageClick: () => void;
}) {
  return (
    <div
      data-slide-card
      className={`relative flex-shrink-0 rounded-xl overflow-hidden bg-zinc-900 cursor-pointer select-none
        ${isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/10 hover:ring-white/30'}`}
      style={{ width: CARD_W, height: CARD_H }}
      onClick={() => { if (!isActive) onActivate(); }}
    >
      {/* ── Iframe — renders IDENTICAL HTML to the PNG export ── */}
      {html ? (
        <iframe
          srcDoc={html}
          className="absolute top-0 left-0 border-none pointer-events-none"
          style={{
            width:           SLIDE_W,
            height:          SLIDE_H,
            transform:       `scale(${SCALE})`,
            transformOrigin: 'top left',
          }}
          sandbox="allow-same-origin"
          title={`Slide ${index + 1} preview`}
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      )}

      {/* Slide number */}
      <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-sm text-white/60 text-[9px] font-mono px-1.5 py-0.5 rounded pointer-events-none">
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Replace image */}
      <button
        className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-sm text-white/60 hover:text-white hover:bg-black/80 rounded-lg p-1.5 transition-colors"
        onClick={e => { e.stopPropagation(); onImageClick(); }}
        title="Replace image"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Drag handles (active slide only) */}
      {isActive && (
        <>
          <DragHandle
            x={custom.hlX} y={custom.hlY}
            label="H" color="bg-blue-500"
            onDragEnd={(x, y) => onPositionChange('hl', x, y)}
          />
          {hasBody && (
            <DragHandle
              x={custom.bodyX} y={custom.bodyY}
              label="B" color="bg-purple-500"
              onDragEnd={(x, y) => onPositionChange('body', x, y)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Main PreviewEditor ─────────────────────────────────────────────────────
export default function PreviewEditor({ slides, imageUrls, textCustomizations, onChange, loading }: Props) {
  const [template,      setTemplate]      = useState<string>('');
  const [activeSlide,   setActiveSlide]   = useState<number | null>(null);
  const [savedState,    setSavedState]    = useState<TextCustomization | null>(null);
  const [pinterestSlide, setPinterestSlide] = useState(0);
  const [showPinterest, setShowPinterest] = useState(false);

  // The image URLs shown in iframes — starts with previewUrls, updated when custom.imageUrl is set
  const [localImageUrls, setLocalImageUrls] = useState<string[]>([]);
  useEffect(() => { setLocalImageUrls(imageUrls); }, [imageUrls]);

  // Also sync imageUrls from textCustomizations when they arrive
  useEffect(() => {
    setLocalImageUrls(prev => {
      const next = [...prev];
      textCustomizations.forEach((c, i) => {
        if (c?.imageUrl && !next[i]) next[i] = c.imageUrl;
      });
      return next;
    });
  }, [textCustomizations]);

  // Fetch the slide template once on mount
  useEffect(() => {
    fetch(`/api/slide-template?v=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.text())
      .then(setTemplate)
      .catch(err => console.error('[PreviewEditor] failed to load template', err));
  }, []);

  // Build iframe HTML for every slide (memoized — only recomputes when inputs change)
  const slideHtmls = useMemo<string[]>(() => {
    if (!template) return slides.map(() => '');
    return slides.map((slide, i) => {
      const c   = textCustomizations[i];
      const img = localImageUrls[i] ?? imageUrls[i] ?? '';
      if (!c) return '';
      return buildSlideHtml(template, {
        overlayStyle:  slide.overlay_style ?? 'dark-cinematic',
        imageUrl:      img,
        headlineHtml:  c.headlineHtml,
        hlStyle:       c.hlStyle,
        hlX:           c.hlX,
        hlY:           c.hlY,
        hlFont:        c.hlFont,
        hlFontSize:    c.hlFontSize,
        bodyHtml:      c.bodyHtml,
        bodyStyle:     c.bodyStyle,
        bodyX:         c.bodyX,
        bodyY:         c.bodyY,
        bodyFont:      c.bodyFont,
        bodyFontSize:  c.bodyFontSize,
        textBoxWidth:  c.textBoxWidth,
      });
    });
  }, [template, slides, textCustomizations, localImageUrls, imageUrls]);

  // ── Active slide helpers ─────────────────────────────────────────────────
  function openSlide(i: number) {
    setSavedState({ ...textCustomizations[i] });
    setActiveSlide(i);
  }

  function commitChange(i: number, partial: Partial<TextCustomization>) {
    const next = { ...textCustomizations[i], ...partial };
    onChange(i, next);
  }

  function handlePositionChange(block: 'hl' | 'body', x: number, y: number) {
    if (activeSlide === null) return;
    commitChange(activeSlide, block === 'hl' ? { hlX: x, hlY: y } : { bodyX: x, bodyY: y });
  }

  function saveEdit() {
    setSavedState(null);
    setActiveSlide(null);
  }

  function cancelEdit() {
    if (activeSlide !== null && savedState) onChange(activeSlide, savedState);
    setSavedState(null);
    setActiveSlide(null);
  }

  function handlePinterestSelect(previewUrl: string, fullUrl: string) {
    setLocalImageUrls(prev => {
      const next = [...prev];
      next[pinterestSlide] = fullUrl; // show the 736x image in the iframe too
      return next;
    });
    const existing = textCustomizations[pinterestSlide] ?? {} as TextCustomization;
    onChange(pinterestSlide, { ...existing, imageUrl: fullUrl, previewUrl });
    setShowPinterest(false);
  }

  if (!slides.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <div className="text-5xl opacity-20">🎬</div>
        <p className="text-sm text-gray-400">Generate slides to preview them here</p>
      </div>
    );
  }

  const activeCustom = activeSlide !== null ? textCustomizations[activeSlide] : null;
  const hasBody      = !!(activeCustom?.bodyHtml);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs uppercase tracking-widest font-medium">
          Preview Editor
        </span>
        {activeSlide !== null && (
          <span className="text-gray-400 text-xs">
            Slide {activeSlide + 1} — drag <span className="text-blue-500 font-bold">H</span> / <span className="text-purple-500 font-bold">B</span> to reposition
          </span>
        )}
      </div>

      {/* Carousel */}
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'thin' }}
      >
        {slides.map((slide, i) => {
          const custom = textCustomizations[i];
          if (!custom) return null;
          return (
            <div key={i} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
              <SlideCard
                html={slideHtmls[i] ?? ''}
                index={i}
                isActive={activeSlide === i}
                custom={custom}
                hasBody={!!custom.bodyHtml}
                onActivate={() => openSlide(i)}
                onPositionChange={handlePositionChange}
                onImageClick={() => { setPinterestSlide(i); setShowPinterest(true); }}
              />
            </div>
          );
        })}

        {/* CTA slide — always last, non-editable */}
        {slides.length > 0 && (
          <div style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
            <div
              className="relative flex-shrink-0 rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-white/10"
              style={{ width: CARD_W, height: CARD_H }}
            >
              <img src="/cta.png" alt="CTA" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-sm text-white/60 text-[9px] font-mono px-1.5 py-0.5 rounded pointer-events-none">
                CTA
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto">
        {slides.map((_, i) => {
          const img = localImageUrls[i] ?? imageUrls[i];
          return (
            <button
              key={i}
              onClick={() => openSlide(i)}
              className={`flex-shrink-0 rounded overflow-hidden transition-all ${
                activeSlide === i ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-200 hover:ring-gray-400'
              }`}
              style={{ width: 36, height: 64 }}
            >
              {img
                ? <img src={img} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-[7px] font-mono">
                    {String(i + 1).padStart(2, '0')}
                  </div>
              }
            </button>
          );
        })}
        {/* CTA thumbnail */}
        {slides.length > 0 && (
          <div
            className="flex-shrink-0 rounded overflow-hidden ring-1 ring-gray-200"
            style={{ width: 36, height: 64 }}
          >
            <img src="/cta.png" alt="CTA" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* ── Edit panel ────────────────────────────────────────────────────── */}
      {activeSlide !== null && activeCustom && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">

          {/* Headline section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[7px] font-black flex-shrink-0">H</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Headline</span>
            </div>
            <textarea
              value={stripHtml(activeCustom.headlineHtml)}
              onChange={e => commitChange(activeSlide, { headlineHtml: e.target.value })}
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400 resize-none"
            />
            <div className="flex gap-2">
              <select
                value={activeCustom.hlStyle}
                onChange={e => commitChange(activeSlide, { hlStyle: e.target.value as TextStyle })}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-gray-400"
              >
                {STYLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select
                value={activeCustom.hlFont ?? (slides[activeSlide]?.overlay_style === 'organic-raw' ? 'montserrat' : 'bebas')}
                onChange={e => commitChange(activeSlide, { hlFont: e.target.value as FontKey })}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-gray-400"
              >
                {FONT_OPTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              {/* Font size stepper */}
              <SizeStepper
                value={activeCustom.hlFontSize ?? 128}
                min={32} max={220} step={4}
                onChange={v => commitChange(activeSlide, { hlFontSize: v })}
              />
            </div>
          </div>

          {/* Text box width */}
          <div className="pt-1 border-t border-gray-100 flex items-center gap-3">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-medium flex-shrink-0">Box Width</span>
            <SizeStepper
              value={activeCustom.textBoxWidth ?? 780}
              min={200} max={1020} step={20}
              onChange={v => commitChange(activeSlide, { textBoxWidth: v })}
            />
            <span className="text-[10px] text-gray-400">px</span>
            {activeCustom.textBoxWidth && (
              <button
                onClick={() => commitChange(activeSlide, { textBoxWidth: undefined })}
                className="text-[10px] text-gray-400 hover:text-gray-700 underline"
              >reset</button>
            )}
          </div>

          {/* Body section (only if slide has body text) */}
          {hasBody && (
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white text-[7px] font-black flex-shrink-0">B</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Body</span>
              </div>
              <textarea
                value={stripHtml(activeCustom.bodyHtml)}
                onChange={e => commitChange(activeSlide, { bodyHtml: e.target.value })}
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400 resize-none"
              />
              <div className="flex gap-2">
                <select
                  value={activeCustom.bodyStyle}
                  onChange={e => commitChange(activeSlide, { bodyStyle: e.target.value as TextStyle })}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-gray-400"
                >
                  {STYLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select
                  value={activeCustom.bodyFont ?? (slides[activeSlide]?.overlay_style === 'organic-raw' ? 'montserrat' : 'inter')}
                  onChange={e => commitChange(activeSlide, { bodyFont: e.target.value as FontKey })}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-gray-400"
                >
                  {FONT_OPTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                {/* Font size stepper */}
                <SizeStepper
                  value={activeCustom.bodyFontSize ?? 38}
                  min={16} max={100} step={2}
                  onChange={v => commitChange(activeSlide, { bodyFontSize: v })}
                />
              </div>
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            {/* Replace image */}
            <button
              onClick={() => { setPinterestSlide(activeSlide); setShowPinterest(true); }}
              className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-900 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Replace Image
            </button>

            <div className="flex-1" />

            <button
              onClick={cancelEdit}
              className="bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              ✓ Done
            </button>
          </div>
        </div>
      )}

      {/* Pinterest modal */}
      {showPinterest && (
        <PinterestSearchModal
          initialQuery={`ugc ${slides[pinterestSlide]?.image_search ?? ''}`}
          onSelect={handlePinterestSelect}
          onClose={() => setShowPinterest(false)}
        />
      )}
    </div>
  );
}
