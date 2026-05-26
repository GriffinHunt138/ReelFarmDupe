'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { buildSlideSvg, stripHtmlForSvg } from '@/lib/stability/slide-svg';
import type { FontKey } from '@/lib/stability/slide-svg';
import type { StabilitySlideCustomization } from '@/components/StabilitySlideEditorCard';
import StabilityRock from '@/components/StabilityRock';
import type { RockCostume } from '@/components/StabilityRock';

// ── Constants ─────────────────────────────────────────────────────────────────
const CARD_W  = 220;
const SLIDE_W = 1080;
const SLIDE_H = 1920;
const SCALE   = CARD_W / SLIDE_W;            // ≈ 0.2037
const CARD_H  = Math.round(SLIDE_H * SCALE); // ≈ 390

// ── Font options (copied from PreviewEditor) ──────────────────────────────────
export const FONT_OPTS: { value: FontKey; label: string }[] = [
  { value: 'default',    label: 'Default (Helvetica)' },
  { value: 'bebas',      label: 'Bebas Neue'          },
  { value: 'inter',      label: 'Inter'               },
  { value: 'anton',      label: 'Anton'               },
  { value: 'oswald',     label: 'Oswald'              },
  { value: 'playfair',   label: 'Playfair Display'    },
  { value: 'montserrat', label: 'Montserrat'          },
];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface StabilitySlideEntry {
  id: string;
  custom: StabilitySlideCustomization;
}

interface Props {
  slides:   StabilitySlideEntry[];
  onChange: (id: string, custom: StabilitySlideCustomization) => void;
  onAdd:    () => void;
  onDelete: (id: string) => void;
  onMove:   (id: string, dir: -1 | 1) => void;
  costume?: RockCostume;
}

type Block = 'chip' | 'hl' | 'body' | 'accent' | 'rocky' | 'img' | 'imgResize';

// Rocky at 340px wide on 1080px canvas → card scale:
const ROCKY_PREVIEW_SIZE = Math.round((340 / SLIDE_W) * CARD_W); // ≈ 69px

// ── SizeStepper (exact copy from PreviewEditor) ───────────────────────────────
function SizeStepper({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center border border-white/15 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="px-1.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors"
      >−</button>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="w-10 text-center text-xs text-white bg-transparent focus:outline-none tabular-nums py-1.5"
      />
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="px-1.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors"
      >+</button>
    </div>
  );
}

// ── TextBlockResizer (adapted from PreviewEditor) ─────────────────────────────
// Renders left + right edge drag handles and a dashed bounding box on the card.
// hlX / hlY are % of the card (= % of slide); width is px on the 1080-px slide.
function TextBlockResizer({
  hlX, hlY, width, onResize,
}: {
  hlX: number; hlY: number;
  width: number;          // slide-px width (on 1080-px canvas)
  onResize: (newHlX: number, newWidth: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const widthPct  = (width / SLIDE_W) * 100;
  const leftPct   = hlX - widthPct / 2;
  const rightPct  = hlX + widthPct / 2;
  const boxTopPct = hlY - 7.5;
  const boxHPct   = 15;

  const startDrag = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const card = containerRef.current?.closest('[data-slide-card]') as HTMLElement | null;
    if (!card) return;

    const fixedLeft  = hlX - (width / SLIDE_W) * 50;
    const fixedRight = hlX + (width / SLIDE_W) * 50;

    const onMove = (ev: MouseEvent) => {
      const r  = card.getBoundingClientRect();
      const mx = Math.max(1, Math.min(99, ((ev.clientX - r.left) / r.width) * 100));
      let newCenterPct: number, newWidthPx: number;
      if (side === 'right') {
        if (mx <= fixedLeft + 3) return;
        const wPct   = mx - fixedLeft;
        newCenterPct = fixedLeft + wPct / 2;
        newWidthPx   = Math.round((wPct / 100) * SLIDE_W);
      } else {
        if (fixedRight <= mx + 3) return;
        const wPct   = fixedRight - mx;
        newCenterPct = mx + wPct / 2;
        newWidthPx   = Math.round((wPct / 100) * SLIDE_W);
      }
      onResize(
        Math.max(5, Math.min(95, newCenterPct)),
        Math.max(120, Math.min(1060, newWidthPx)),
      );
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [hlX, width, onResize]);

  const handleCls =
    'absolute top-1/2 -translate-y-1/2 w-[6px] h-8 bg-blue-500 rounded-sm cursor-ew-resize pointer-events-auto shadow-lg';

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 25 }}>
      {/* Dashed bounding box */}
      <div
        className="absolute border border-dashed border-blue-400/60"
        style={{
          left:   `${leftPct}%`,
          top:    `${boxTopPct}%`,
          width:  `${widthPct}%`,
          height: `${boxHPct}%`,
          pointerEvents: 'none',
        }}
      />
      {/* Left edge handle */}
      <div
        className={handleCls}
        style={{ left: `${leftPct}%`, top: `${hlY}%`, transform: 'translate(-50%, -50%)' }}
        onMouseDown={e => startDrag('left', e)}
      />
      {/* Right edge handle */}
      <div
        className={handleCls}
        style={{ left: `${rightPct}%`, top: `${hlY}%`, transform: 'translate(-50%, -50%)' }}
        onMouseDown={e => startDrag('right', e)}
      />
    </div>
  );
}

// ── Drag handle ───────────────────────────────────────────────────────────────
function DragHandle({
  x, y, label, color, onDragEnd,
}: {
  x: number; y: number; label: string; color: string;
  onDragEnd: (x: number, y: number) => void;
}) {
  const [live, setLive] = useState({ x, y });
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        x: Math.max(5, Math.min(95, ((ev.clientX - r.left) / r.width)  * 100)),
        y: Math.max(5, Math.min(95, ((ev.clientY - r.top)  / r.height) * 100)),
      });
    };
    const onUp = (ev: MouseEvent) => {
      dragging.current = false;
      const card = containerRef.current?.closest('[data-slide-card]') as HTMLElement | null;
      if (!card) return;
      const r  = card.getBoundingClientRect();
      const nx = Math.max(5, Math.min(95, ((ev.clientX - r.left) / r.width)  * 100));
      const ny = Math.max(5, Math.min(95, ((ev.clientY - r.top)  / r.height) * 100));
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
    >
      {label}
    </div>
  );
}

// ── SVG builder hook ──────────────────────────────────────────────────────────
// Returns the raw SVG string (no imageDataUrl so the SVG stays fast).
// Image is shown as a separate React overlay on the card.
function useSlideSvg(custom: StabilitySlideCustomization): string {
  return useMemo(() => buildSlideSvg({
    chip:        stripHtmlForSvg(custom.chipHtml),
    headline:    stripHtmlForSvg(custom.hlHtml),
    body:        stripHtmlForSvg(custom.bodyHtml),
    accent:      stripHtmlForSvg(custom.accentHtml),
    chipPos:     { x: custom.chipX,   y: custom.chipY   },
    headlinePos: { x: custom.hlX,     y: custom.hlY     },
    bodyPos:     { x: custom.bodyX,   y: custom.bodyY   },
    accentPos:   { x: custom.accentX, y: custom.accentY },
    hlFont:      custom.hlFont,
    hlFontSize:  custom.hlFontSize,
    hlWidth:     custom.hlWidth,
    bodyFont:    custom.bodyFont,
    bodyFontSize: custom.bodyFontSize,
    bodyWidth:   custom.bodyWidth,
    // imageDataUrl intentionally omitted — shown as React overlay
  }), [custom]);
}

// ── Single slide card ──────────────────────────────────────────────────────────
function SlideCard({
  entry, index, isActive, costume,
  onActivate, onPositionChange, onHlWidthResize, onBodyWidthResize,
}: {
  entry: StabilitySlideEntry;
  index: number;
  isActive: boolean;
  costume: RockCostume;
  onActivate: () => void;
  onPositionChange: (block: Block, x: number, y: number) => void;
  onHlWidthResize:   (newX: number, newW: number) => void;
  onBodyWidthResize: (newX: number, newW: number) => void;
}) {
  const { custom } = entry;
  const svgStr = useSlideSvg(custom);
  const hasBody = stripHtmlForSvg(custom.bodyHtml).length > 0;
  const imgCornerX = Math.min(95, custom.imageX + custom.imageW / 2);
  const imgCornerY = Math.min(95, custom.imageY + custom.imageH / 2);

  return (
    <div
      data-slide-card
      className={`relative flex-shrink-0 rounded-xl overflow-hidden cursor-pointer select-none
        ${isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/10 hover:ring-white/30'}`}
      style={{ width: CARD_W, height: CARD_H, background: '#0d1117' }}
      onClick={() => { if (!isActive) onActivate(); }}
    >
      {/* Inline SVG — allows Google Fonts @import to work */}
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}
        dangerouslySetInnerHTML={{ __html: svgStr }}
      />

      {/* Image overlay */}
      {custom.imageDataUrl && (
        <div
          className="absolute pointer-events-none"
          style={{
            left:      `${custom.imageX}%`,
            top:       `${custom.imageY}%`,
            width:     `${(custom.imageW / 100) * CARD_W}px`,
            height:    `${(custom.imageH / 100) * CARD_H}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={custom.imageDataUrl} alt="" className="w-full h-full object-contain" draggable={false} />
        </div>
      )}

      {/* Rocky overlay */}
      <div
        className="absolute z-10 pointer-events-none"
        style={{ left: `${custom.rockyX}%`, top: `${custom.rockyY}%`, transform: 'translate(-50%, -50%)' }}
      >
        <StabilityRock mood="idle" costume={costume} size={ROCKY_PREVIEW_SIZE}/>
      </div>

      {/* Slide number badge */}
      <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-sm text-white/60 text-[9px] font-mono px-1.5 py-0.5 rounded pointer-events-none">
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* ── Active-slide overlays ── */}
      {isActive && (
        <>
          {/* Text-block width resizers */}
          <TextBlockResizer
            hlX={custom.hlX} hlY={custom.hlY}
            width={custom.hlWidth ?? 780}
            onResize={onHlWidthResize}
          />
          {hasBody && (
            <TextBlockResizer
              hlX={custom.bodyX} hlY={custom.bodyY}
              width={custom.bodyWidth ?? 780}
              onResize={onBodyWidthResize}
            />
          )}
          {/* Position drag handles */}
          <DragHandle x={custom.rockyX} y={custom.rockyY} label="R" color="bg-amber-500"
            onDragEnd={(x, y) => onPositionChange('rocky', x, y)} />
          <DragHandle x={custom.hlX} y={custom.hlY} label="H" color="bg-blue-500"
            onDragEnd={(x, y) => onPositionChange('hl', x, y)} />
          {hasBody && (
            <DragHandle x={custom.bodyX} y={custom.bodyY} label="B" color="bg-purple-500"
              onDragEnd={(x, y) => onPositionChange('body', x, y)} />
          )}
          {/* Image handles */}
          {custom.imageDataUrl && (
            <>
              <DragHandle x={custom.imageX} y={custom.imageY} label="I" color="bg-emerald-500"
                onDragEnd={(x, y) => onPositionChange('img', x, y)} />
              <DragHandle x={imgCornerX} y={imgCornerY} label="⊞" color="bg-teal-700"
                onDragEnd={(cx, cy) => {
                  const newW = Math.max(5, Math.min(90, 2 * Math.abs(cx - custom.imageX)));
                  const newH = Math.max(5, Math.min(90, 2 * Math.abs(cy - custom.imageY)));
                  onPositionChange('imgResize', newW, newH);
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Thumbnail — keep as img/data-URL (fast, fonts not needed at tiny size) ────
function Thumb({ entry, isActive, onClick }: {
  entry: StabilitySlideEntry; isActive: boolean; onClick: () => void;
}) {
  const svgStr = useSlideSvg(entry.custom);
  const dataUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`,
    [svgStr],
  );
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 rounded overflow-hidden transition-all ${
        isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/10 hover:ring-white/30'
      }`}
      style={{ width: 36, height: 64 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="" style={{ width: 36, height: 64 }} />
    </button>
  );
}

// ── Main StabilityPreviewEditor ────────────────────────────────────────────────
export default function StabilityPreviewEditor({ slides, onChange, onAdd, onDelete, onMove, costume = 'plain' }: Props) {
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [savedState, setSavedState] = useState<StabilitySlideCustomization | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeIndex = activeId != null ? slides.findIndex(s => s.id === activeId) : -1;
  const activeEntry = activeIndex >= 0 ? slides[activeIndex] : null;

  function openSlide(id: string) {
    const entry = slides.find(s => s.id === id);
    if (entry) setSavedState({ ...entry.custom });
    setActiveId(id);
  }

  function commit(partial: Partial<StabilitySlideCustomization>) {
    if (!activeId || !activeEntry) return;
    onChange(activeId, { ...activeEntry.custom, ...partial });
  }

  function handlePositionChange(block: Block, x: number, y: number) {
    if (block === 'chip')      commit({ chipX: x,   chipY: y   });
    if (block === 'hl')        commit({ hlX: x,     hlY: y     });
    if (block === 'body')      commit({ bodyX: x,   bodyY: y   });
    if (block === 'accent')    commit({ accentX: x, accentY: y });
    if (block === 'rocky')     commit({ rockyX: x,  rockyY: y  });
    if (block === 'img')       commit({ imageX: x,  imageY: y  });
    if (block === 'imgResize') commit({ imageW: x,  imageH: y  });
  }

  function saveEdit()   { setSavedState(null); setActiveId(null); }
  function cancelEdit() {
    if (activeId && savedState) onChange(activeId, savedState);
    setSavedState(null); setActiveId(null);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => commit({ imageDataUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  if (!slides.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <div className="text-5xl opacity-20">🎬</div>
        <p className="text-sm text-white/40">Add a slide to get started</p>
        <button onClick={onAdd}
          className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
          + Add Slide
        </button>
      </div>
    );
  }

  const active  = activeEntry?.custom ?? null;
  const hasBody = active ? stripHtmlForSvg(active.bodyHtml).length > 0 : false;

  return (
    <div className="flex flex-col gap-3">

      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-xs uppercase tracking-widest font-medium">Slide Editor</span>
        {activeId !== null && (
          <span className="text-white/30 text-xs">
            Slide {activeIndex + 1} — drag <span className="text-amber-400 font-bold">R</span>
            {' / '}<span className="text-blue-400 font-bold">H</span>
            {hasBody && <> / <span className="text-purple-400 font-bold">B</span></>}
            {' '}· drag <span className="text-blue-300 font-bold">edges</span> to resize
          </span>
        )}
      </div>

      {/* Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'thin' }}>
        {slides.map((entry, i) => (
          <div key={entry.id} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
            <SlideCard
              entry={entry} index={i}
              isActive={activeId === entry.id}
              costume={costume}
              onActivate={() => openSlide(entry.id)}
              onPositionChange={handlePositionChange}
              onHlWidthResize={(x, w) => { if (activeId) { const e = slides.find(s => s.id === activeId); if (e) onChange(activeId, { ...e.custom, hlX: x, hlWidth: w }); } }}
              onBodyWidthResize={(x, w) => { if (activeId) { const e = slides.find(s => s.id === activeId); if (e) onChange(activeId, { ...e.custom, bodyX: x, bodyWidth: w }); } }}
            />
          </div>
        ))}
        <div style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
          <button onClick={onAdd}
            className="rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 transition-colors flex items-center justify-center text-white/25 hover:text-white/60 text-sm font-medium"
            style={{ width: CARD_W, height: CARD_H }}>
            + Add
          </button>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto">
        {slides.map(entry => (
          <Thumb key={entry.id} entry={entry} isActive={activeId === entry.id} onClick={() => openSlide(entry.id)} />
        ))}
      </div>

      {/* ── Edit panel ─────────────────────────────────────────────────────── */}
      {activeId !== null && active && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">

          {/* ── Headline ── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[7px] font-black flex-shrink-0">H</span>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Headline</span>
            </div>
            <textarea
              value={stripHtmlForSvg(active.hlHtml)}
              onChange={e => commit({ hlHtml: e.target.value })}
              rows={2}
              onKeyDown={e => e.stopPropagation()}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none"
            />
            {/* Font + size row */}
            <div className="flex gap-2">
              <select
                value={active.hlFont ?? 'default'}
                onChange={e => commit({ hlFont: e.target.value as FontKey })}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 min-w-0"
              >
                {FONT_OPTS.map(f => <option key={f.value} value={f.value} className="bg-gray-900">{f.label}</option>)}
              </select>
              <SizeStepper
                value={active.hlFontSize ?? 102}
                min={32} max={220} step={4}
                onChange={v => commit({ hlFontSize: v })}
              />
            </div>
          </div>

          {/* ── Body ── */}
          <div className="space-y-2 pt-1 border-t border-white/8">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white text-[7px] font-black flex-shrink-0">B</span>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Body</span>
            </div>
            <textarea
              value={stripHtmlForSvg(active.bodyHtml)}
              onChange={e => commit({ bodyHtml: e.target.value })}
              rows={2}
              onKeyDown={e => e.stopPropagation()}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none"
            />
            {/* Font + size row */}
            <div className="flex gap-2">
              <select
                value={active.bodyFont ?? 'default'}
                onChange={e => commit({ bodyFont: e.target.value as FontKey })}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 min-w-0"
              >
                {FONT_OPTS.map(f => <option key={f.value} value={f.value} className="bg-gray-900">{f.label}</option>)}
              </select>
              <SizeStepper
                value={active.bodyFontSize ?? 46}
                min={16} max={100} step={2}
                onChange={v => commit({ bodyFontSize: v })}
              />
            </div>
          </div>

          {/* ── Image ── */}
          <div className="space-y-1.5 pt-1 border-t border-white/8">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[7px] font-black flex-shrink-0">I</span>
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Image</span>
              </div>
              {active.imageDataUrl && (
                <button onClick={() => commit({ imageDataUrl: undefined })}
                  className="text-red-400/60 hover:text-red-400 text-[9px] transition-colors">
                  Remove
                </button>
              )}
            </div>
            {active.imageDataUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.imageDataUrl} alt=""
                  className="w-14 h-14 object-contain rounded-lg border border-white/10 bg-black/30 flex-shrink-0" />
                <p className="text-[9px] text-white/30 leading-relaxed">
                  Drag <span className="text-emerald-400 font-bold">I</span> to reposition<br/>
                  Drag <span className="text-teal-400 font-bold">⊞</span> corner to resize
                </p>
              </div>
            ) : (
              <>
                <label htmlFor={`img-upload-${activeId}`}
                  className="flex items-center justify-center gap-2 cursor-pointer w-full bg-white/5 border border-dashed border-white/20 hover:border-white/40 rounded-lg px-3 py-2.5 transition-colors text-white/40 hover:text-white/60 text-xs">
                  + Attach image (PNG / JPG / WebP)
                </label>
                <input id={`img-upload-${activeId}`} ref={fileInputRef} type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden" onChange={handleImageUpload} />
              </>
            )}
          </div>

          {/* ── Actions row ── */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/8">
            <button onClick={() => { onDelete(activeId); setActiveId(null); }}
              className="flex items-center gap-1.5 text-red-400/60 hover:text-red-400 text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-400/10 transition-colors">
              ✕ Delete Slide
            </button>
            <button onClick={() => onMove(activeId, -1)} disabled={activeIndex === 0}
              className="text-white/30 hover:text-white/70 disabled:opacity-20 text-xs px-2 py-1.5 rounded-lg transition-colors">
              ← Move
            </button>
            <button onClick={() => onMove(activeId, 1)} disabled={activeIndex === slides.length - 1}
              className="text-white/30 hover:text-white/70 disabled:opacity-20 text-xs px-2 py-1.5 rounded-lg transition-colors">
              Move →
            </button>
            <div className="flex-1" />
            <button onClick={cancelEdit}
              className="bg-white/8 hover:bg-white/15 text-white/50 hover:text-white/80 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={saveEdit}
              className="bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-white/90 transition-colors">
              ✓ Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
