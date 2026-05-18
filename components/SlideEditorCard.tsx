'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

export interface TextCustomization {
  headlineHtml: string;
  bodyHtml: string;
  hlX: number; hlY: number;
  bodyX: number; bodyY: number;
}

interface Props {
  index: number;
  slide: { headline: string; body?: string | null; overlay_style: string; image_search: string };
  preview?: string;
  imageUrl?: string;
  custom: TextCustomization;
  onChange: (c: TextCustomization) => void;
}

const COLORS = ['#ffffff', '#000000', '#FFE600', '#FF3B3B', '#00D4FF', '#FF6BFF', '#FF8C00'];

const OVERLAY_CSS: Record<string, string> = {
  'dark-cinematic': 'from-black/60 via-black/25 to-black/70',
  'moody-warm':     'from-red-950/80 via-orange-950/50 to-stone-950/90',
  'grain-noir':     'from-zinc-950/85 via-zinc-900/50 to-neutral-950/90',
  'winter-arc':     'from-blue-950/80 via-slate-900/50 to-indigo-950/85',
  'dark-academia':  'from-yellow-950/80 via-stone-900/50 to-amber-950/90',
  'organic-raw':    'from-transparent via-transparent to-black/40',
};

// ── Draggable editable text block ──────────────────────────────────────────
function TextBlock({
  htmlRef, html, x, y, isHeadline, isOrganic, editing, cardRef,
  onFocus, onInput, onPositionChange,
}: {
  htmlRef: React.RefObject<HTMLDivElement | null>;
  html: string;
  x: number; y: number;
  isHeadline: boolean;
  isOrganic: boolean;
  editing: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onFocus: () => void;
  onInput: () => void;
  onPositionChange: (x: number, y: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  // Sync innerHTML without clobbering caret
  useEffect(() => {
    const el = htmlRef.current;
    if (!el) return;
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [html, htmlRef]);

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
      {/* Drag handle — only visible in edit mode */}
      {editing && (
        <div
          className="flex justify-center mb-0.5 cursor-grab active:cursor-grabbing"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
        >
          <div className="flex gap-0.5 opacity-50 hover:opacity-100 transition-opacity">
            {[0,1,2,3,4,5].map(i => <div key={i} className="w-0.5 h-0.5 rounded-full bg-white" />)}
          </div>
        </div>
      )}

      <div
        ref={htmlRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onFocus={onFocus}
        onInput={onInput}
        className={`outline-none w-full ${isHeadline
          ? isOrganic
            ? 'font-extrabold leading-tight text-[10px] tracking-tight'
            : 'font-black uppercase leading-tight text-[11px] tracking-wide'
          : isOrganic
            ? 'text-[8px] font-medium leading-snug mt-0.5 tracking-tight'
            : 'text-[8px] font-semibold leading-snug mt-0.5'
        } ${editing ? 'cursor-text' : 'cursor-default pointer-events-none'}`}
        style={{
          fontFamily: isOrganic ? '"Inter", sans-serif' : '"Bebas Neue", Impact, sans-serif',
          color: '#ffffff',
          textShadow: isOrganic
            ? '0 1px 12px rgba(0,0,0,0.5)'
            : '0 1px 6px rgba(0,0,0,0.9)',
          minWidth: 40,
          caretColor: 'white',
        }}
      />

      {/* Editing outline */}
      {editing && (
        <div className="absolute inset-0 -m-1 rounded border border-dashed border-white/30 pointer-events-none" />
      )}
    </div>
  );
}

// ── Main card ───────────────────────────────────────────────────────────────
export default function SlideEditorCard({ index, slide, preview, imageUrl, custom, onChange }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [activeBlock, setActiveBlock] = useState<'headline' | 'body'>('headline');
  const [hasSelection, setHasSelection] = useState(false);

  const gradient = OVERLAY_CSS[slide.overlay_style] ?? OVERLAY_CSS['dark-cinematic'];
  const isOrganic = slide.overlay_style === 'organic-raw';
  const bg = preview ?? imageUrl;

  // Track selection state for formatting buttons
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      setHasSelection(!!sel && !sel.isCollapsed && sel.toString().length > 0);
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  // Click outside → exit edit
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [editing]);

  function captureContent() {
    onChange({
      ...custom,
      headlineHtml: hlRef.current?.innerHTML ?? custom.headlineHtml,
      bodyHtml:     bodyRef.current?.innerHTML ?? custom.bodyHtml,
    });
  }

  function applyBold() {
    document.execCommand('bold');
    captureContent();
  }

  function applyColor(color: string) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.color = color;
    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    captureContent();
  }

  const setHlPos = useCallback((x: number, y: number) => onChange({ ...custom, hlX: x, hlY: y }), [custom, onChange]);
  const setBodyPos = useCallback((x: number, y: number) => onChange({ ...custom, bodyX: x, bodyY: y }), [custom, onChange]);

  return (
    <div
      ref={cardRef}
      className={`relative rounded-xl overflow-hidden bg-zinc-900
        ${editing ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-black' : 'border border-white/8'}
        ${preview ? '' : 'cursor-pointer'}`}
      style={{ aspectRatio: '9/16' }}
      onClick={() => { if (!editing && !preview) setEditing(true); }}
    >
      {/* Background */}
      {bg && <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />}
      {!preview && <div className={`absolute inset-0 bg-gradient-to-b ${gradient} pointer-events-none`} />}

      {/* Slide number */}
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 text-white/60 text-xs font-mono z-10 pointer-events-none">
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Editable text blocks */}
      {!preview && (
        <>
          <TextBlock
            htmlRef={hlRef}
            html={custom.headlineHtml}
            x={custom.hlX} y={custom.hlY}
            isHeadline
            isOrganic={isOrganic}
            editing={editing}
            cardRef={cardRef}
            onFocus={() => setActiveBlock('headline')}
            onInput={captureContent}
            onPositionChange={setHlPos}
          />
          {custom.bodyHtml && (
            <TextBlock
              htmlRef={bodyRef}
              html={custom.bodyHtml}
              x={custom.bodyX} y={custom.bodyY}
              isHeadline={false}
              isOrganic={isOrganic}
              editing={editing}
              cardRef={cardRef}
              onFocus={() => setActiveBlock('body')}
              onInput={captureContent}
              onPositionChange={setBodyPos}
            />
          )}
        </>
      )}

      {/* Formatting toolbar */}
      {editing && !preview && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-sm px-2 py-1.5 flex items-center gap-1.5"
          onMouseDown={e => e.preventDefault()} // don't blur contenteditable
        >
          {/* Bold */}
          <button
            onClick={applyBold}
            className={`text-white font-black text-[11px] w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${hasSelection ? 'bg-white/20 hover:bg-white/40' : 'opacity-30 cursor-default'}`}
          >
            B
          </button>

          <div className="w-px h-3 bg-white/20 flex-shrink-0" />

          {/* Color swatches */}
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => applyColor(c)}
              className={`w-3.5 h-3.5 rounded-full flex-shrink-0 transition-all ${hasSelection ? 'hover:scale-125 cursor-pointer' : 'opacity-30 cursor-default'}`}
              style={{
                background: c,
                outline: '1px solid rgba(255,255,255,0.2)',
                outlineOffset: '1px',
              }}
            />
          ))}

          <div className="ml-auto flex items-center gap-2 text-[9px] text-white/40">
            <span>{activeBlock}</span>
            <button onClick={() => setEditing(false)} className="text-white/30 hover:text-white/70 transition-colors">✕</button>
          </div>
        </div>
      )}

      {/* Hover hint */}
      {!editing && !preview && (
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-black/60 text-white/50 text-[9px] rounded px-1.5 py-0.5">click to edit</div>
        </div>
      )}
    </div>
  );
}
