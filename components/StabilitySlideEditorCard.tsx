'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import StabilityRock from '@/components/StabilityRock';

export interface StabilitySlideCustomization {
  chipHtml:    string;  chipX:    number; chipY:    number;
  hlHtml:      string;  hlX:      number; hlY:      number;
  bodyHtml:    string;  bodyX:    number; bodyY:    number;
  accentHtml:  string;  accentX:  number; accentY:  number;
  rockyX:      number;  rockyY:   number;
  // Font / size / width (mirrors PreviewEditor's TextCustomization)
  hlFont?:       import('@/lib/stability/slide-svg').FontKey;
  hlFontSize?:   number;   // px on 1080-px canvas
  hlWidth?:      number;   // px width of headline block (default 780)
  bodyFont?:     import('@/lib/stability/slide-svg').FontKey;
  bodyFontSize?: number;   // px on 1080-px canvas
  bodyWidth?:    number;   // px width of body block (default 780)
  // Optional overlay image
  imageDataUrl?: string;
  imageX: number;  // center % of slide width
  imageY: number;  // center % of slide height
  imageW: number;  // width % of slide width
  imageH: number;  // height % of slide height
}

export function defaultStabilityCustomization(opts: {
  chip?: string; headline: string; body?: string; accent?: string;
}): StabilitySlideCustomization {
  return {
    chipHtml:   opts.chip    ?? '',  chipX:   50, chipY:   11,
    hlHtml:     opts.headline,       hlX:     50, hlY:     32,
    bodyHtml:   opts.body    ?? '',  bodyX:   50, bodyY:   54,
    accentHtml: opts.accent  ?? '',  accentX: 50, accentY: 70,
    rockyX: 50, rockyY: 84,
    hlWidth:   780, bodyWidth:   780,
    imageDataUrl: undefined,
    imageX: 50, imageY: 30,
    imageW: 40, imageH: 25,
  };
}

type ActiveBlock = 'chip' | 'headline' | 'body' | 'accent' | null;

const COLORS = ['#ffffff', '#000000', '#FFE600', '#FF3B3B', '#5ce1ff', '#FF6BFF', '#FF8C00'];

// ── Draggable editable text block ─────────────────────────────────────────────
function TextBlock({
  elRef, html, x, y, className, style,
  active, editing, cardRef,
  onPointerDown, onInput, onPositionChange,
}: {
  elRef: React.RefObject<HTMLDivElement | null>;
  html: string;
  x: number; y: number;
  className?: string;
  style?: React.CSSProperties;
  active: boolean;
  editing: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.MouseEvent) => void;
  onInput: () => void;
  onPositionChange: (x: number, y: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  // Sync html without clobbering caret
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html;
  }, [html, elRef]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!cardRef.current) return;
      const r = cardRef.current.getBoundingClientRect();
      onPositionChange(
        Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100)),
        Math.max(5, Math.min(95, ((e.clientY - r.top) / r.height) * 100)),
      );
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, cardRef, onPositionChange]);

  return (
    <div
      className="absolute z-20 text-center"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', width: '88%' }}
    >
      {/* Drag handle */}
      {active && editing && (
        <div
          className="flex justify-center mb-0.5 cursor-grab active:cursor-grabbing"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
        >
          <div className="flex gap-0.5 opacity-50 hover:opacity-100 transition-opacity">
            {[0,1,2,3,4,5].map(i => <div key={i} className="w-0.5 h-0.5 rounded-full bg-white/60"/>)}
          </div>
        </div>
      )}

      <div
        ref={elRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onMouseDown={onPointerDown}
        onInput={onInput}
        className={`outline-none w-full ${className ?? ''} ${editing ? 'cursor-text' : 'cursor-default pointer-events-none'}`}
        style={{ caretColor: 'white', minWidth: 20, ...style }}
      />

      {active && editing && (
        <div className="absolute inset-0 -m-0.5 rounded border border-dashed border-white/30 pointer-events-none"/>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
interface Props {
  index: number;
  custom: StabilitySlideCustomization;
  onChange: (c: StabilitySlideCustomization) => void;
}

export default function StabilitySlideEditorCard({ index, custom, onChange }: Props) {
  const cardRef    = useRef<HTMLDivElement>(null);
  const chipRef    = useRef<HTMLDivElement>(null);
  const hlRef      = useRef<HTMLDivElement>(null);
  const bodyRef    = useRef<HTMLDivElement>(null);
  const accentRef  = useRef<HTMLDivElement>(null);
  const [editing, setEditing]      = useState(false);
  const [active,  setActive]       = useState<ActiveBlock>(null);
  const [hasSel,  setHasSel]       = useState(false);

  // Track selection for formatting buttons
  useEffect(() => {
    const h = () => {
      const s = window.getSelection();
      setHasSel(!!s && !s.isCollapsed && s.toString().length > 0);
    };
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
  }, []);

  // Click outside → exit edit
  useEffect(() => {
    if (!editing) return;
    const h = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setEditing(false); setActive(null);
      }
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [editing]);

  function capture() {
    onChange({
      ...custom,
      chipHtml:   chipRef.current?.innerHTML   ?? custom.chipHtml,
      hlHtml:     hlRef.current?.innerHTML     ?? custom.hlHtml,
      bodyHtml:   bodyRef.current?.innerHTML   ?? custom.bodyHtml,
      accentHtml: accentRef.current?.innerHTML ?? custom.accentHtml,
    });
  }

  function applyBold() { document.execCommand('bold'); capture(); }

  function applyColor(color: string) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.color = color;
    try { range.surroundContents(span); }
    catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
    sel.removeAllRanges();
    capture();
  }

  const setPos = useCallback((field: 'chip'|'hl'|'body'|'accent') =>
    (x: number, y: number) => onChange({
      ...custom,
      [`${field}X`]: x,
      [`${field}Y`]: y,
    } as StabilitySlideCustomization),
  [custom, onChange]);

  function activateBlock(block: ActiveBlock, e: React.MouseEvent) {
    if (editing) { setActive(block); return; }
    e.preventDefault();
    setEditing(true); setActive(block);
  }

  const hasChip   = custom.chipHtml.replace(/<[^>]+>/g,'').trim().length > 0;
  const hasBody   = custom.bodyHtml.replace(/<[^>]+>/g,'').trim().length > 0;
  const hasAccent = custom.accentHtml.replace(/<[^>]+>/g,'').trim().length > 0;

  return (
    <div
      ref={cardRef}
      className={`relative rounded-xl overflow-hidden select-none
        ${editing ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-black' : 'cursor-pointer border border-white/8'}`}
      style={{ aspectRatio: '9/16', background: '#0d1117' }}
      onClick={() => { if (!editing) { setEditing(true); setActive('headline'); } }}
    >
      {/* Subtle radial glow at top */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 90% 40% at 50% 0%, #1a274480 0%, transparent 100%)',
      }}/>

      {/* Slide number */}
      <div className="absolute top-2 left-2 bg-black/50 rounded px-1.5 py-0.5 text-white/40 text-[9px] font-mono z-10 pointer-events-none">
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* ── Chip ── */}
      {(hasChip || editing) && (
        <TextBlock
          elRef={chipRef}
          html={custom.chipHtml}
          x={custom.chipX} y={custom.chipY}
          active={active === 'chip'}
          editing={editing}
          cardRef={cardRef}
          onPointerDown={e => activateBlock('chip', e)}
          onInput={capture}
          onPositionChange={setPos('chip')}
          className="text-[7px] font-bold tracking-widest uppercase leading-none"
          style={{
            color: '#5ce1ff',
            background: editing && active === 'chip' ? 'transparent' : '#1a2744',
            borderRadius: 20,
            padding: '3px 10px',
            display: 'inline-block',
            width: 'auto',
            maxWidth: '80%',
            margin: '0 auto',
          }}
        />
      )}

      {/* ── Headline ── */}
      <TextBlock
        elRef={hlRef}
        html={custom.hlHtml}
        x={custom.hlX} y={custom.hlY}
        active={active === 'headline'}
        editing={editing}
        cardRef={cardRef}
        onPointerDown={e => activateBlock('headline', e)}
        onInput={capture}
        onPositionChange={setPos('hl')}
        className="font-black leading-tight text-[11px]"
        style={{ color: '#ffffff', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
      />

      {/* ── Body ── */}
      {(hasBody || editing) && (
        <TextBlock
          elRef={bodyRef}
          html={custom.bodyHtml}
          x={custom.bodyX} y={custom.bodyY}
          active={active === 'body'}
          editing={editing}
          cardRef={cardRef}
          onPointerDown={e => activateBlock('body', e)}
          onInput={capture}
          onPositionChange={setPos('body')}
          className="text-[7.5px] font-normal leading-snug"
          style={{ color: '#b0bec5' }}
        />
      )}

      {/* ── Accent ── */}
      {(hasAccent || editing) && (
        <TextBlock
          elRef={accentRef}
          html={custom.accentHtml}
          x={custom.accentX} y={custom.accentY}
          active={active === 'accent'}
          editing={editing}
          cardRef={cardRef}
          onPointerDown={e => activateBlock('accent', e)}
          onInput={capture}
          onPositionChange={setPos('accent')}
          className="text-[9px] font-bold leading-snug"
          style={{ color: '#5ce1ff' }}
        />
      )}

      {/* ── Rocky zone ── */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1.5 pointer-events-none" style={{ height: '28%' }}>
        <StabilityRock mood="idle" size={36}/>
      </div>

      {/* ── Formatting toolbar ── */}
      {editing && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-sm px-2 py-1.5 flex items-center gap-1.5"
          onMouseDown={e => e.preventDefault()}
        >
          <button
            onClick={applyBold}
            className={`text-white font-black text-[11px] w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${hasSel ? 'bg-white/20 hover:bg-white/40' : 'opacity-30 cursor-default'}`}
          >B</button>

          <div className="w-px h-3 bg-white/20 flex-shrink-0"/>

          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => applyColor(c)}
              className={`w-3 h-3 rounded-full flex-shrink-0 transition-transform ${hasSel ? 'hover:scale-125 cursor-pointer' : 'opacity-30 cursor-default'}`}
              style={{ background: c, outline: '1px solid rgba(255,255,255,0.2)', outlineOffset: 1 }}
            />
          ))}

          <div className="ml-auto flex items-center gap-2 text-[9px] text-white/40">
            <span>{active ?? '—'}</span>
            <button onClick={() => { setEditing(false); setActive(null); }} className="hover:text-white/70">✕</button>
          </div>
        </div>
      )}

      {/* Hover hint */}
      {!editing && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-black/60 text-white/50 text-[9px] rounded px-1.5 py-0.5">click to edit</div>
        </div>
      )}
    </div>
  );
}
