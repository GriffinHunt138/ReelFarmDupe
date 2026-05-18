'use client';

import SlideEditorCard from './SlideEditorCard';
export type { TextCustomization } from './SlideEditorCard';

interface Slide {
  headline: string;
  body?: string | null;
  overlay_style: string;
  image_search: string;
}

import type { TextCustomization } from './SlideEditorCard';

interface Props {
  slides: Slide[];
  previews?: string[];
  imageUrls?: string[];
  textCustomizations: TextCustomization[];
  onTextChange: (index: number, c: TextCustomization) => void;
  loading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-zinc-900 border border-white/8 animate-pulse" style={{ aspectRatio: '9/16' }}>
      <div className="w-full h-full bg-zinc-800" />
    </div>
  );
}

export default function SlidePreviewGrid({ slides, previews, imageUrls, textCustomizations, onTextChange, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!slides.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
        <div className="text-4xl">🎬</div>
        <div className="text-sm">Generate a slideshow to see your slides here</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
      {slides.map((slide, i) => (
        <SlideEditorCard
          key={i}
          index={i}
          slide={slide}
          preview={previews?.[i]}
          imageUrl={imageUrls?.[i]}
          custom={textCustomizations[i] ?? { headlineHtml: slide.headline, bodyHtml: slide.body ?? '', hlX: 50, hlY: 50, bodyX: 50, bodyY: 65 }}
          onChange={c => onTextChange(i, c)}
        />
      ))}
    </div>
  );
}
