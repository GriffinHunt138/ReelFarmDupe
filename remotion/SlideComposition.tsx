/**
 * remotion/SlideComposition.tsx
 *
 * Full motion-graphics slide composition.
 * Remotion owns the entire visual design — layout, colors, graphic elements,
 * and animations — based on slide content. Nothing is just text on a dark BG.
 *
 * Canvas: 1080 × 1920 px at 30 fps.
 */

import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  delayRender,
  continueRender,
} from 'remotion';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FontKey =
  | 'default' | 'bebas' | 'inter' | 'anton'
  | 'oswald' | 'playfair' | 'montserrat';

export interface SlideContent {
  chip?:        string;
  headline:     string;
  body?:        string;
  accent?:      string;
  hlFont?:      FontKey;
  hlFontSize?:  number;
  bodyFont?:    FontKey;
  bodyFontSize?: number;
  imageDataUrl?: string;
}

// ─── Font families ────────────────────────────────────────────────────────────

const FF: Record<FontKey, string> = {
  default:    '"Helvetica Neue", Arial, sans-serif',
  bebas:      '"Bebas Neue", Impact, sans-serif',
  inter:      '"Inter", "Helvetica Neue", Arial, sans-serif',
  anton:      '"Anton", Impact, sans-serif',
  oswald:     '"Oswald", "Arial Narrow", Arial, sans-serif',
  playfair:   '"Playfair Display", Georgia, serif',
  montserrat: '"Montserrat", "Helvetica Neue", Arial, sans-serif',
};

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Bebas+Neue' +
  '&family=Inter:wght@400;700;800;900' +
  '&family=Anton' +
  '&family=Oswald:wght@400;600;700' +
  '&family=Playfair+Display:ital,wght@0,700;0,800;1,700' +
  '&family=Montserrat:wght@400;700;800;900' +
  '&display=swap';

function useFonts() {
  const [handle] = useState(() => delayRender('Fonts'));
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    link.onload = () => continueRender(handle);
    link.onerror = () => continueRender(handle);
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─── Color themes ─────────────────────────────────────────────────────────────

interface Theme {
  blobColor:    string;   // large bg glow
  blobColor2:   string;   // secondary glow
  accent:       string;   // chip, lines, highlights
  accentDim:    string;   // dimmer variant
  chipBg:       string;
  chipFg:       string;
  topBar:       string;   // thin colored bar at very top
}

const THEMES: Record<string, Theme> = {
  problem: {
    blobColor:  'rgba(160, 20, 10, 0.45)',
    blobColor2: 'rgba(100, 8, 0, 0.25)',
    accent:     '#ff4d4d',
    accentDim:  '#7b1818',
    chipBg:     '#3d0a0a',
    chipFg:     '#ff6b6b',
    topBar:     '#cc2222',
  },
  solution: {
    blobColor:  'rgba(10, 60, 120, 0.50)',
    blobColor2: 'rgba(0, 100, 180, 0.22)',
    accent:     '#5ce1ff',
    accentDim:  '#1a3a5a',
    chipBg:     '#0a2040',
    chipFg:     '#5ce1ff',
    topBar:     '#0077cc',
  },
  action: {
    blobColor:  'rgba(10, 110, 50, 0.45)',
    blobColor2: 'rgba(0, 80, 30, 0.22)',
    accent:     '#39ff88',
    accentDim:  '#0a3a1a',
    chipBg:     '#062218',
    chipFg:     '#39ff88',
    topBar:     '#00aa55',
  },
  neutral: {
    blobColor:  'rgba(20, 50, 120, 0.45)',
    blobColor2: 'rgba(60, 20, 120, 0.20)',
    accent:     '#a78bfa',
    accentDim:  '#2d1a5a',
    chipBg:     '#1a1240',
    chipFg:     '#c4b5fd',
    topBar:     '#7c3aed',
  },
  default: {
    blobColor:  'rgba(20, 40, 100, 0.50)',
    blobColor2: 'rgba(0, 80, 120, 0.20)',
    accent:     '#5ce1ff',
    accentDim:  '#1a2744',
    chipBg:     '#1a2744',
    chipFg:     '#5ce1ff',
    topBar:     '#1e6fa8',
  },
};

function detectTheme(chip = '', headline = ''): Theme {
  const txt = (chip + ' ' + headline).toUpperCase();
  if (/PROBLEM|PAIN|WRONG|BAD|MISTAKE|STOP|HURT|DANGER|RISK|FAIL|WHY|ALERT/.test(txt)) return THEMES.problem;
  if (/FIX|SOLUTION|HOW|TIP|STEP|METHOD|BETTER|IMPROVE|HEAL|BOOST|HELP/.test(txt))     return THEMES.solution;
  if (/DO THIS|ACTION|START|NOW|TODAY|RESULT|GOAL|COMMIT|BEGIN|TRY|CHALLENGE/.test(txt)) return THEMES.action;
  if (/SCIENCE|FACT|RESEARCH|STUDY|DATA|STAT|PROOF|ACTUALLY|TRUTH/.test(txt))           return THEMES.neutral;
  return THEMES.default;
}

// ─── Template selection ───────────────────────────────────────────────────────

type Template = 'hook' | 'feature' | 'stat';

function detectTemplate(chip = '', headline = '', body = '', accent = ''): Template {
  // If accent looks like a stat (contains digits + unit), use stat template
  if (/\d/.test(accent) && accent.length < 30) return 'stat';
  // If there's a meaningful body, use feature
  if (body && body.trim().length > 15) return 'feature';
  return 'hook';
}

// ─── Animation helpers ────────────────────────────────────────────────────────

function sp(frame: number, fps: number, delay = 0, cfg = { damping: 22, stiffness: 110, mass: 0.9 }) {
  return spring({ frame: Math.max(0, frame - delay), fps, config: cfg });
}

function lerp(p: number, a: number, b: number) {
  return a + (b - a) * Math.min(1, Math.max(0, p));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated background: dark base + moving glow blob(s) + subtle grid. */
function Background({ theme, frame, totalFrames }: { theme: Theme; frame: number; totalFrames: number }) {
  // Blob slowly drifts and breathes across the full clip duration
  const t     = frame / totalFrames;
  const blobX = 50 + 12 * Math.sin(t * Math.PI * 2);
  const blobY = 35 + 8  * Math.sin(t * Math.PI * 1.5 + 0.5);
  const breath = 1 + 0.06 * Math.sin(frame * 0.04);

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0a0d14', overflow: 'hidden' }}>
      {/* Primary color blob */}
      <div style={{
        position: 'absolute',
        width: 900 * breath, height: 900 * breath,
        borderRadius: '50%',
        left: `${blobX}%`, top: `${blobY}%`,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${theme.blobColor} 0%, transparent 70%)`,
        opacity: fadeIn,
        filter: 'blur(0px)',
        pointerEvents: 'none',
      }}/>

      {/* Secondary blob — offset for depth */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        left: `${100 - blobX * 0.6}%`,
        top:  `${100 - blobY * 0.4}%`,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${theme.blobColor2} 0%, transparent 70%)`,
        opacity: fadeIn * 0.7,
        pointerEvents: 'none',
      }}/>

      {/* Subtle grid — horizontal lines only */}
      {[1,2,3,4,5,6,7].map(i => (
        <div key={i} style={{
          position: 'absolute',
          left: 0, right: 0,
          top: `${i * 12.5}%`,
          height: 1,
          background: 'rgba(255,255,255,0.025)',
          pointerEvents: 'none',
        }}/>
      ))}

      {/* Vignette — darken corners */}
      <AbsoluteFill style={{
        background: 'radial-gradient(ellipse 90% 85% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)',
        pointerEvents: 'none',
        opacity: fadeIn,
      }}/>

      {/* Thin top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: interpolate(sp(frame, 30, 2), [0, 1], [0, 5]),
        background: `linear-gradient(90deg, transparent, ${theme.topBar}, transparent)`,
      }}/>
    </AbsoluteFill>
  );
}

/** Colored chip/label pill with a subtle glow ring. */
function ChipPill({
  text, theme, frame, fps,
}: { text: string; theme: Theme; frame: number; fps: number }) {
  const progress = sp(frame, fps, 4, { damping: 18, stiffness: 130, mass: 0.7 });
  const glow     = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      transform: `translateY(${lerp(progress, -50, 0)}px)`,
      opacity: progress,
    }}>
      {/* Glow ring */}
      <div style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}>
        <div style={{
          position: 'absolute',
          inset: -4,
          borderRadius: 40,
          background: theme.accentDim,
          opacity: glow * 0.5,
          filter: `blur(8px)`,
        }}/>
        <div style={{
          position: 'relative',
          background: theme.chipBg,
          color: theme.chipFg,
          borderRadius: 36,
          border: `1.5px solid ${theme.accentDim}`,
          padding: '16px 40px',
          fontSize: 30,
          fontFamily: '"Inter", "Helvetica Neue", sans-serif',
          fontWeight: 800,
          letterSpacing: 4,
          textTransform: 'uppercase' as const,
          whiteSpace: 'nowrap' as const,
        }}>
          {text}
        </div>
      </div>
    </div>
  );
}

/** Word-by-word reveal — each word slides up + unblurs with spring. */
function WordReveal({
  text, frame, fps, delay, fontSize, fontFamily, fontWeight, color,
  letterSpacing = -1, lineHeight = 1.15,
}: {
  text: string; frame: number; fps: number; delay: number;
  fontSize: number; fontFamily: string; fontWeight: number | string;
  color: string; letterSpacing?: number; lineHeight?: number;
}) {
  const words = text.trim().split(/\s+/);
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: `${fontSize * 0.05}px ${fontSize * 0.28}px`,
      lineHeight,
    }}>
      {words.map((word, i) => {
        const p = sp(frame, fps, delay + i * 3, { damping: 20, stiffness: 130, mass: 0.85 });
        return (
          <span key={i} style={{
            display: 'inline-block',
            fontSize,
            fontFamily,
            fontWeight,
            color,
            letterSpacing,
            lineHeight,
            transform: `translateY(${lerp(p, 60, 0)}px)`,
            opacity: p,
            filter: `blur(${lerp(p, 6, 0)}px)`,
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
}

/** Horizontal accent line that draws in left-to-right. */
function DrawLine({
  frame, fps, delay, color, maxWidth = 480, thickness = 2,
}: { frame: number; fps: number; delay: number; color: string; maxWidth?: number; thickness?: number }) {
  const p = sp(frame, fps, delay, { damping: 28, stiffness: 90, mass: 1 });
  return (
    <div style={{
      width: lerp(p, 0, maxWidth),
      height: thickness,
      background: `linear-gradient(90deg, ${color}, ${color}88)`,
      borderRadius: thickness,
      opacity: Math.min(1, p * 2),
    }}/>
  );
}

/** Body text block: slides up + fades. */
function BodyBlock({
  text, frame, fps, delay, fontSize, fontFamily, color,
}: {
  text: string; frame: number; fps: number; delay: number;
  fontSize: number; fontFamily: string; color: string;
}) {
  const p = sp(frame, fps, delay);
  return (
    <div style={{
      fontSize,
      fontFamily,
      fontWeight: 400,
      color,
      lineHeight: 1.5,
      textAlign: 'center',
      maxWidth: 860,
      transform: `translateY(${lerp(p, 36, 0)}px)`,
      opacity: p,
    }}>
      {text}
    </div>
  );
}

/** Optional image overlay — centered, composited above the background. */
function ImageOverlay({
  src, frame, fps,
}: { src: string; frame: number; fps: number }) {
  const p = sp(frame, fps, 6);
  return (
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: `translate(-50%, -50%) scale(${lerp(p, 0.92, 1)})`,
      opacity: p * 0.9,
      maxWidth: '70%',
      maxHeight: '40%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
    </div>
  );
}

/** Large accent/stat — scales up with glow. */
function AccentBlock({
  text, frame, fps, delay, color,
}: { text: string; frame: number; fps: number; delay: number; color: string }) {
  const p    = sp(frame, fps, delay, { damping: 16, stiffness: 140, mass: 0.8 });
  const glow = sp(frame, fps, delay + 4);
  return (
    <div style={{ position: 'relative', textAlign: 'center' }}>
      {/* Glow behind text */}
      <div style={{
        position: 'absolute',
        inset: '-20px -40px',
        background: `radial-gradient(ellipse, ${color}22 0%, transparent 70%)`,
        opacity: glow,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'relative',
        fontSize: 76,
        fontFamily: '"Inter", "Helvetica Neue", sans-serif',
        fontWeight: 900,
        color,
        letterSpacing: -1,
        transform: `scale(${lerp(p, 0.75, 1)})`,
        opacity: p,
      }}>
        {text}
      </div>
    </div>
  );
}

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * HOOK template — short punchy headline, minimal design.
 * Big text centered in the power third, dramatic background.
 */
function HookTemplate({
  content, theme, frame, fps, totalFrames,
}: {
  content: SlideContent; theme: Theme; frame: number; fps: number; totalFrames: number;
}) {
  const headline = content.headline ?? '';
  const chip     = content.chip ?? '';

  const hlFont   = FF[content.hlFont ?? 'inter'];
  const hw       = headline.split(/\s+/).length;
  const hfs      = content.hlFontSize ?? (hw <= 4 ? 128 : hw <= 6 ? 108 : 88);

  // Large decorative corner element
  const cornerP = sp(frame, fps, 6);

  return (
    <AbsoluteFill>
      <Background theme={theme} frame={frame} totalFrames={totalFrames}/>

      {/* Top-right corner bracket */}
      <div style={{
        position: 'absolute',
        top: 80, right: 80,
        width: 80, height: 80,
        borderTop: `3px solid ${theme.accent}`,
        borderRight: `3px solid ${theme.accent}`,
        opacity: lerp(cornerP, 0, 0.5),
        transform: `scale(${lerp(cornerP, 0.6, 1)})`,
        transformOrigin: 'top right',
      }}/>
      {/* Bottom-left corner bracket */}
      <div style={{
        position: 'absolute',
        bottom: 80, left: 80,
        width: 80, height: 80,
        borderBottom: `3px solid ${theme.accent}`,
        borderLeft: `3px solid ${theme.accent}`,
        opacity: lerp(cornerP, 0, 0.5),
        transform: `scale(${lerp(cornerP, 0.6, 1)})`,
        transformOrigin: 'bottom left',
      }}/>

      {/* Chip — if present */}
      {chip && (
        <div style={{
          position: 'absolute',
          top: 180,
          left: 0, right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <ChipPill text={chip} theme={theme} frame={frame} fps={fps}/>
        </div>
      )}

      {/* Main headline — vertically centered or slightly above center */}
      <div style={{
        position: 'absolute',
        top: chip ? '38%' : '42%',
        left: 60, right: 60,
        transform: 'translateY(-50%)',
        textAlign: 'center',
      }}>
        <WordReveal
          text={headline}
          frame={frame} fps={fps}
          delay={chip ? 16 : 8}
          fontSize={hfs}
          fontFamily={hlFont}
          fontWeight={900}
          color="#ffffff"
          letterSpacing={hfs > 100 ? -3 : -1}
          lineHeight={1.1}
        />
      </div>

      {/* Accent line — draws in below headline area */}
      <div style={{
        position: 'absolute',
        top: chip ? 'calc(38% + 20px)' : 'calc(42% + 20px)',
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        marginTop: Math.round(hfs * (hw > 4 ? 2.2 : 1.2)),
      }}>
        <DrawLine frame={frame} fps={fps} delay={chip ? 30 : 22} color={theme.accent} maxWidth={320}/>
      </div>
    </AbsoluteFill>
  );
}

/**
 * FEATURE template — chip + headline + body + optional accent.
 * Full layout with decorative separator.
 */
function FeatureTemplate({
  content, theme, frame, fps, totalFrames,
}: {
  content: SlideContent; theme: Theme; frame: number; fps: number; totalFrames: number;
}) {
  const headline = content.headline ?? '';
  const body     = content.body     ?? '';
  const chip     = content.chip     ?? '';
  const accent   = content.accent   ?? '';

  const hlFont   = FF[content.hlFont   ?? 'inter'];
  const bodyFont = FF[content.bodyFont ?? 'inter'];
  const hw       = headline.split(/\s+/).length;
  const hfs      = content.hlFontSize  ?? (hw <= 5 ? 96 : hw <= 8 ? 82 : 70);
  const bfs      = content.bodyFontSize ?? 44;

  return (
    <AbsoluteFill>
      <Background theme={theme} frame={frame} totalFrames={totalFrames}/>

      {/* Chip */}
      {chip && (
        <div style={{
          position: 'absolute',
          top: 160,
          left: 0, right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <ChipPill text={chip} theme={theme} frame={frame} fps={fps}/>
        </div>
      )}

      {/* Headline */}
      <div style={{
        position: 'absolute',
        top: chip ? '30%' : '26%',
        left: 60, right: 60,
        transform: 'translateY(-50%)',
        textAlign: 'center',
      }}>
        <WordReveal
          text={headline}
          frame={frame} fps={fps}
          delay={chip ? 18 : 8}
          fontSize={hfs}
          fontFamily={hlFont}
          fontWeight={800}
          color="#ffffff"
          letterSpacing={-1}
        />
      </div>

      {/* Separator: dot + line */}
      <div style={{
        position: 'absolute',
        top: chip ? 'calc(30% + 20px)' : 'calc(26% + 20px)',
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginTop: Math.round(hfs * (hw > 5 ? 2.0 : 1.3)),
      }}>
        {/* Left line */}
        <div style={{ transform: 'scaleX(-1)' }}>
          <DrawLine frame={frame} fps={fps} delay={chip ? 34 : 22} color={theme.accent} maxWidth={200} thickness={1.5}/>
        </div>
        {/* Center dot */}
        <div style={{
          width: 8, height: 8, borderRadius: 4,
          background: theme.accent,
          opacity: lerp(sp(frame, fps, chip ? 34 : 22), 0, 1),
        }}/>
        {/* Right line */}
        <DrawLine frame={frame} fps={fps} delay={chip ? 34 : 22} color={theme.accent} maxWidth={200} thickness={1.5}/>
      </div>

      {/* Body */}
      {body && (
        <div style={{
          position: 'absolute',
          top: chip ? '56%' : '52%',
          left: 80, right: 80,
          transform: 'translateY(-50%)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <BodyBlock
            text={body}
            frame={frame} fps={fps}
            delay={chip ? 44 : 32}
            fontSize={bfs}
            fontFamily={bodyFont}
            color="#d0dde8"
          />
        </div>
      )}

      {/* Accent */}
      {accent && (
        <div style={{
          position: 'absolute',
          top: body ? '76%' : '68%',
          left: 0, right: 0,
          transform: 'translateY(-50%)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <AccentBlock
            text={accent}
            frame={frame} fps={fps}
            delay={chip ? 54 : 42}
            color={theme.accent}
          />
        </div>
      )}
    </AbsoluteFill>
  );
}

/**
 * STAT template — accent stat is the hero, headline is the context.
 * Centered, bold stat number with ring + supporting text.
 */
function StatTemplate({
  content, theme, frame, fps, totalFrames,
}: {
  content: SlideContent; theme: Theme; frame: number; fps: number; totalFrames: number;
}) {
  const headline = content.headline ?? '';
  const body     = content.body     ?? '';
  const chip     = content.chip     ?? '';
  const accent   = content.accent   ?? '';

  const hlFont = FF[content.hlFont ?? 'inter'];

  const ringP = sp(frame, fps, 8, { damping: 30, stiffness: 80, mass: 1.2 });
  const ringR = lerp(ringP, 0, 220);

  return (
    <AbsoluteFill>
      <Background theme={theme} frame={frame} totalFrames={totalFrames}/>

      {/* Chip */}
      {chip && (
        <div style={{
          position: 'absolute',
          top: 160, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}>
          <ChipPill text={chip} theme={theme} frame={frame} fps={fps}/>
        </div>
      )}

      {/* Ring graphic behind stat */}
      <div style={{
        position: 'absolute',
        top: '42%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: ringR * 2, height: ringR * 2,
        borderRadius: '50%',
        border: `2px solid ${theme.accent}`,
        opacity: lerp(ringP, 0, 0.2),
      }}/>
      <div style={{
        position: 'absolute',
        top: '42%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: ringR * 2 * 0.7, height: ringR * 2 * 0.7,
        borderRadius: '50%',
        border: `1px solid ${theme.accent}`,
        opacity: lerp(ringP, 0, 0.12),
      }}/>

      {/* Big stat number */}
      <div style={{
        position: 'absolute',
        top: '42%', left: 0, right: 0,
        transform: 'translateY(-50%)',
        display: 'flex', justifyContent: 'center',
      }}>
        <AccentBlock
          text={accent}
          frame={frame} fps={fps}
          delay={10}
          color={theme.accent}
        />
      </div>

      {/* Headline below stat */}
      <div style={{
        position: 'absolute',
        top: '62%', left: 60, right: 60,
        transform: 'translateY(-50%)',
        textAlign: 'center',
      }}>
        <WordReveal
          text={headline}
          frame={frame} fps={fps}
          delay={22}
          fontSize={content.hlFontSize ?? 72}
          fontFamily={hlFont}
          fontWeight={700}
          color="#ffffff"
        />
      </div>

      {/* Body */}
      {body && (
        <div style={{
          position: 'absolute',
          top: '78%', left: 80, right: 80,
          transform: 'translateY(-50%)',
          display: 'flex', justifyContent: 'center',
        }}>
          <BodyBlock
            text={body}
            frame={frame} fps={fps}
            delay={32}
            fontSize={content.bodyFontSize ?? 40}
            fontFamily={FF[content.bodyFont ?? 'inter']}
            color="#d0dde8"
          />
        </div>
      )}
    </AbsoluteFill>
  );
}

// ─── Main composition ─────────────────────────────────────────────────────────

interface Props {
  content?: SlideContent;
}

export const SlideComposition: React.FC<Props> = ({ content: _content }) => {
  const content: SlideContent = _content ?? { headline: '' };
  useFonts();

  const frame              = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const chip     = content.chip     ?? '';
  const headline = content.headline ?? '';
  const body     = content.body     ?? '';
  const accent   = content.accent   ?? '';

  const theme    = detectTheme(chip, headline);
  const template = detectTemplate(chip, headline, body, accent);

  const shared = { content, theme, frame, fps, totalFrames: durationInFrames };

  return (
    <AbsoluteFill>
      {template === 'stat'    && <StatTemplate    {...shared}/>}
      {template === 'feature' && <FeatureTemplate {...shared}/>}
      {template === 'hook'    && <HookTemplate    {...shared}/>}
      {/* Image overlay — sits above the template design if provided */}
      {content.imageDataUrl && (
        <ImageOverlay src={content.imageDataUrl} frame={frame} fps={fps}/>
      )}
    </AbsoluteFill>
  );
};
