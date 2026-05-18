'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import PinterestSearchModal from './PinterestSearchModal';

export type TextStyle =
  | 'default' | 'outline' | 'white-text' | 'black-text' | 'yellow-text'
  | 'white-bg' | 'white-50-bg' | 'black-bg' | 'black-50-bg';

export interface TextCustomization {
  headlineHtml: string;
  bodyHtml: string;
  hlX: number; hlY: number;
  bodyX: number; bodyY: number;
  hlStyle: TextStyle;
  bodyStyle: TextStyle;
  imageUrl?: string;     // full 736x Pinterest URL for final render
  previewUrl?: string;   // thumbnail Pinterest URL for editor display
}

interface SlideData {
  headline: string;
  body?: string | null;
  image_search: string;
  overlay_style: string;
}

interface Props {
  slides: SlideData[];
  imageUrls: string[];
  textCustomizations: TextCustomization[];
  onChange: (index: number, c: TextCustomization) => void;
  loading?: boolean;
}

export const STYLE_OPTS: { value: TextStyle; label: string }[] = [
  { value: 'default',      label: 'Default' },
  { value: 'outline',      label: 'Outline' },
  { value: 'white-text',   label: 'White Text' },
  { value: 'black-text',   label: 'Black Text' },
  { value: 'yellow-text',  label: 'Yellow Text' },
  { value: 'white-bg',     label: 'White Background' },
  { value: 'white-50-bg',  label: 'White 50% Background' },
  { value: 'black-bg',     label: 'Black Background' },
  { value: 'black-50-bg',  label: 'Black 50% Background' },
];

const OVERLAY_GRADIENT: Record<string, string> = {
  'dark-cinematic': 'from-black/60 via-black/25 to-black/70',
  'moody-warm':     'from-red-950/80 via-orange-950/50 to-stone-950/90',
  'grain-noir':     'from-zinc-950/85 via-zinc-900/50 to-neutral-950/90',
  'winter-arc':     'from-blue-950/80 via-slate-900/50 to-indigo-950/85',
  'dark-academia':  'from-yellow-950/80 via-stone-900/50 to-amber-950/90',
  'organic-raw':    'from-black/25 via-black/15 to-black/55',
};

export function textStyleCSS(style: TextStyle): React.CSSProperties {
  switch (style) {
    case 'outline':
      return { color: '#fff', WebkitTextStroke: '1px #000' };
    case 'white-text':
      return { color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' };
    case 'black-text':
      return { color: '#000', textShadow: 'none' };
    case 'yellow-text':
      return { color: '#FFE600', textShadow: '0 1px 4px rgba(0,0,0,0.5)' };
    case 'white-bg':
      return { color: '#000', background: '#fff', padding: '1px 6px', borderRadius: '3px', display: 'inline-block', textShadow: 'none' };
    case 'white-50-bg':
      return { color: '#fff', background: 'rgba(255,255,255,0.5)', padding: '1px 6px', borderRadius: '3px', display: 'inline-block', textShadow: 'none' };
    case 'black-bg':
      return { color: '#fff', background: '#000', padding: '1px 6px', borderRadius: '3px', display: 'inline-block', textShadow: 'none' };
    case 'black-50-bg':
      return { color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: '3px', display: 'inline-block', textShadow: 'none' };
    default:
      return { color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' };
  }
}

// ── Individual slide card ──────────────────────────────────────────────────
function SlideCard({
  slide, imageUrl, custom, index,
  isActive, activeBlock,
  onActivate, onSelectBlock, onPositionChange, onTextChange, onImageClick,
}: {
  slide: SlideData;
  imageUrl: string;
  custom: TextCustomization;
  index: number;
  isActive: boolean;
  activeBlock: 'hl' | 'body';
  onActivate: () => void;
  onSelectBlock: (b: 'hl' | 'body') => void;
  onPositionChange: (b: 'hl' | 'body', x: number, y: number) => void;
  onTextChange: (headlineHtml: string, bodyHtml: string) => void;
  onImageClick: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hlRef   = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'hl' | 'body' | null>(null);

  const isOrganic = slide.overlay_style === 'organic-raw';
  const gradient  = OVERLAY_GRADIENT[slide.overlay_style] ?? OVERLAY_GRADIENT['dark-cinematic'];
  const hlCSS     = textStyleCSS(custom.hlStyle ?? 'default');
  const bodyCSS   = textStyleCSS(custom.bodyStyle ?? 'default');

  // Sync innerHTML without clobbering an active caret
  useEffect(() => {
    const el = hlRef.current;
    if (!el || document.activeElement === el) return;
    if (el.innerHTML !== custom.headlineHtml) el.innerHTML = custom.headlineHtml;
  }, [custom.headlineHtml]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || document.activeElement === el) return;
    if (el.innerHTML !== custom.bodyHtml) el.innerHTML = custom.bodyHtml;
  }, [custom.bodyHtml]);

  // Drag handler
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!cardRef.current) return;
      const r = cardRef.current.getBoundingClientRect();
      onPositionChange(
        dragging,
        Math.max(5, Math.min(95, ((e.clientX - r.left)  / r.width)  * 100)),
        Math.max(5, Math.min(95, ((e.clientY - r.top)   / r.height) * 100)),
      );
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',  onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, onPositionChange]);

  function captureText() {
    onTextChange(hlRef.current?.innerHTML ?? '', bodyRef.current?.innerHTML ?? '');
  }

  const hlSel   = isActive && activeBlock === 'hl';
  const bodySel = isActive && activeBlock === 'body';

  return (
    <div
      ref={cardRef}
      className={`relative flex-shrink-0 rounded-xl overflow-hidden bg-zinc-900 cursor-pointer select-none
        ${isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/10 hover:ring-white/30'}`}
      style={{ width: 210, height: 373 }}
      onClick={() => { if (!isActive) onActivate(); }}
    >
      {/* Slide number */}
      <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-sm text-white/60 text-[9px] font-mono px-1.5 py-0.5 rounded pointer-events-none">
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Replace image button */}
      <button
        className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-sm text-white/60 hover:text-white hover:bg-black/80 rounded-lg p-1.5 transition-colors"
        onClick={e => { e.stopPropagation(); onImageClick(); }}
        title="Replace image"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Background */}
      {imageUrl
        ? <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
        : <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      }
      <div className={`absolute inset-0 bg-gradient-to-b ${gradient} pointer-events-none`} />

      {/* Headline block */}
      <TextBlock
        elRef={hlRef}
        x={custom.hlX} y={custom.hlY}
        selected={hlSel}
        isActive={isActive}
        isHeadline
        isOrganic={isOrganic}
        styleCSS={hlCSS}
        onSelect={() => { if (!isActive) onActivate(); onSelectBlock('hl'); }}
        onDragStart={() => { onActivate(); onSelectBlock('hl'); setDragging('hl'); }}
        onInput={captureText}
      />

      {/* Body block */}
      {custom.bodyHtml && (
        <TextBlock
          elRef={bodyRef}
          x={custom.bodyX} y={custom.bodyY}
          selected={bodySel}
          isActive={isActive}
          isHeadline={false}
          isOrganic={isOrganic}
          styleCSS={bodyCSS}
          onSelect={() => { if (!isActive) onActivate(); onSelectBlock('body'); }}
          onDragStart={() => { onActivate(); onSelectBlock('body'); setDragging('body'); }}
          onInput={captureText}
        />
      )}
    </div>
  );
}

function TextBlock({
  elRef, x, y, selected, isActive, isHeadline, isOrganic, styleCSS, onSelect, onDragStart, onInput,
}: {
  elRef: React.RefObject<HTMLDivElement | null>;
  x: number; y: number;
  selected: boolean;
  isActive: boolean;
  isHeadline: boolean;
  isOrganic: boolean;
  styleCSS: React.CSSProperties;
  onSelect: () => void;
  onDragStart: () => void;
  onInput: () => void;
}) {
  return (
    <div
      className="absolute z-10 text-center"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', width: '90%' }}
    >
      {/* Drag handle */}
      {isActive && (
        <div
          className="flex justify-center mb-0.5 cursor-grab active:cursor-grabbing"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onDragStart(); }}
        >
          <div className="flex gap-0.5 opacity-50 hover:opacity-90 transition-opacity">
            {[...Array(6)].map((_, i) => <div key={i} className="w-0.5 h-0.5 rounded-full bg-white" />)}
          </div>
        </div>
      )}

      {/* Selection box */}
      <div
        className={`relative ${selected ? 'outline outline-1 outline-blue-500 outline-dashed rounded-[2px]' : ''}`}
        onClick={e => { e.stopPropagation(); onSelect(); }}
      >
        {selected && (
          <>
            <span className="absolute -top-px -left-px w-1.5 h-1.5 bg-blue-500 rounded-[1px] z-20 block" />
            <span className="absolute -top-px -right-px w-1.5 h-1.5 bg-blue-500 rounded-[1px] z-20 block" />
            <span className="absolute -bottom-px -left-px w-1.5 h-1.5 bg-blue-500 rounded-[1px] z-20 block" />
            <span className="absolute -bottom-px -right-px w-1.5 h-1.5 bg-blue-500 rounded-[1px] z-20 block" />
          </>
        )}
        <div
          ref={elRef}
          contentEditable={isActive}
          suppressContentEditableWarning
          onInput={onInput}
          className={`outline-none w-full leading-tight
            ${isHeadline
              ? isOrganic ? 'text-[11px] font-extrabold tracking-tight' : 'text-[13px] font-black uppercase tracking-wide'
              : isOrganic ? 'text-[8px] font-medium tracking-tight mt-0.5' : 'text-[8px] font-semibold mt-0.5'
            }
            ${isActive ? 'cursor-text' : 'cursor-default pointer-events-none'}`}
          style={{
            fontFamily: isHeadline && !isOrganic ? '"Bebas Neue", Impact, sans-serif' : '"Inter", sans-serif',
            caretColor: 'white',
            minWidth: 30,
            ...styleCSS,
          }}
        />
      </div>
    </div>
  );
}

// ── Main PreviewEditor ─────────────────────────────────────────────────────
export default function PreviewEditor({ slides, imageUrls, textCustomizations, onChange, loading }: Props) {
  const [activeSlide, setActiveSlide] = useState<number | null>(null);
  const [activeBlock, setActiveBlock] = useState<'hl' | 'body'>('hl');
  // Draft: edits in progress for the active slide (committed on Save)
  const [draft, setDraft] = useState<TextCustomization | null>(null);
  // Saved state captured when entering edit mode (used to revert on Cancel)
  const [savedState, setSavedState] = useState<TextCustomization | null>(null);

  const [pinterestSlide, setPinterestSlide] = useState(0);
  const [showPinterest, setShowPinterest] = useState(false);

  // Per-slide preview image URLs (can be overridden by Pinterest picks)
  const [localImageUrls, setLocalImageUrls] = useState<string[]>([]);
  useEffect(() => { setLocalImageUrls(imageUrls); }, [imageUrls]);

  function openSlide(i: number) {
    // Save any in-progress draft first
    if (activeSlide !== null && draft) {
      onChange(activeSlide, draft);
    }
    const c = textCustomizations[i];
    setActiveSlide(i);
    setActiveBlock('hl');
    setDraft({ ...c });
    setSavedState({ ...c });
  }

  function handlePositionChange(block: 'hl' | 'body', x: number, y: number) {
    if (!draft) return;
    setDraft(block === 'hl' ? { ...draft, hlX: x, hlY: y } : { ...draft, bodyX: x, bodyY: y });
  }

  function handleTextChange(headlineHtml: string, bodyHtml: string) {
    if (!draft) return;
    setDraft(d => d ? { ...d, headlineHtml, bodyHtml } : d);
  }

  function setActiveStyle(style: TextStyle) {
    if (!draft) return;
    setDraft(activeBlock === 'hl' ? { ...draft, hlStyle: style } : { ...draft, bodyStyle: style });
  }

  function saveEdit() {
    if (activeSlide !== null && draft) onChange(activeSlide, draft);
    setDraft(null);
    setSavedState(null);
    setActiveSlide(null);
  }

  function cancelEdit() {
    if (activeSlide !== null && savedState) onChange(activeSlide, savedState);
    setDraft(null);
    setSavedState(null);
    setActiveSlide(null);
  }

  function handlePinterestSelect(previewUrl: string, fullUrl: string) {
    // Update preview URL shown in editor
    setLocalImageUrls(prev => {
      const next = [...prev];
      next[pinterestSlide] = previewUrl;
      return next;
    });
    // Persist to customizations
    const c = { ...(textCustomizations[pinterestSlide] ?? {}), imageUrl: fullUrl, previewUrl } as TextCustomization;
    onChange(pinterestSlide, c);
    // Also update draft if this is the active slide
    if (activeSlide === pinterestSlide && draft) {
      setDraft({ ...draft, imageUrl: fullUrl, previewUrl });
    }
    setShowPinterest(false);
  }

  if (!slides.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-white/25 gap-3">
        <div className="text-5xl opacity-30">🎬</div>
        <p className="text-sm">Generate slides to preview them here</p>
      </div>
    );
  }

  const activeDraft = (activeSlide !== null && draft) ? draft : null;
  const currentStyle = activeBlock === 'hl'
    ? (activeDraft?.hlStyle ?? textCustomizations[activeSlide ?? 0]?.hlStyle ?? 'default')
    : (activeDraft?.bodyStyle ?? textCustomizations[activeSlide ?? 0]?.bodyStyle ?? 'default');
  const hasBody = activeSlide !== null && !!(activeDraft ?? textCustomizations[activeSlide])?.bodyHtml;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-xs uppercase tracking-widest font-medium">Preview Editor</span>
        {activeSlide !== null && <span className="text-white/30 text-xs">Slide {activeSlide + 1} — click text to edit</span>}
      </div>

      {/* Carousel */}
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'thin' }}
      >
        {slides.map((slide, i) => {
          const custom = (activeSlide === i && draft) ? draft : textCustomizations[i];
          if (!custom) return null;
          return (
            <div key={i} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
              <SlideCard
                slide={slide}
                imageUrl={localImageUrls[i] ?? imageUrls[i] ?? ''}
                custom={custom}
                index={i}
                isActive={activeSlide === i}
                activeBlock={activeBlock}
                onActivate={() => openSlide(i)}
                onSelectBlock={b => { if (activeSlide !== i) openSlide(i); setActiveBlock(b); }}
                onPositionChange={handlePositionChange}
                onTextChange={handleTextChange}
                onImageClick={() => { setPinterestSlide(i); setShowPinterest(true); }}
              />
            </div>
          );
        })}
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => openSlide(i)}
            className={`flex-shrink-0 rounded overflow-hidden transition-all ${
              activeSlide === i ? 'ring-2 ring-blue-500' : 'ring-1 ring-white/20 hover:ring-white/40'
            }`}
            style={{ width: 36, height: 64 }}
          >
            {(localImageUrls[i] ?? imageUrls[i]) ? (
              <img src={localImageUrls[i] ?? imageUrls[i]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white/30 text-[7px] font-mono">
                {String(i + 1).padStart(2, '0')}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Edit toolbar — only when a slide is active */}
      {activeSlide !== null && (
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            {/* Block navigator */}
            <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg px-2 py-1.5 border border-white/8">
              <button
                onClick={() => setActiveBlock(activeBlock === 'hl' ? 'body' : 'hl')}
                disabled={!hasBody}
                className="text-white/50 hover:text-white disabled:opacity-30 text-xs w-4"
              >‹</button>
              <span className="text-white/50 text-[10px] font-mono px-1 tabular-nums">
                {activeBlock === 'hl' ? 1 : 2}/{hasBody ? 2 : 1}
              </span>
              <button
                onClick={() => setActiveBlock(activeBlock === 'hl' ? 'body' : 'hl')}
                disabled={!hasBody}
                className="text-white/50 hover:text-white disabled:opacity-30 text-xs w-4"
              >›</button>
            </div>

            {/* Style dropdown */}
            <select
              value={currentStyle}
              onChange={e => setActiveStyle(e.target.value as TextStyle)}
              className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-white/30 cursor-pointer"
            >
              {STYLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Replace image */}
            <button
              onClick={() => { setPinterestSlide(activeSlide); setShowPinterest(true); }}
              className="flex items-center gap-1 bg-zinc-800 border border-white/10 text-white/60 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors flex-shrink-0"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image
            </button>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white/50 hover:text-white text-xs font-medium py-2 rounded-lg transition-colors"
            >
              ✕ Cancel edits
            </button>
            <button
              onClick={saveEdit}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg transition-colors"
            >
              ✓ Save
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
