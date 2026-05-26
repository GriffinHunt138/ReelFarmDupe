import type { RockMood } from './types';

// Eyebrow paths [left, right] per mood
const BROWS: Record<RockMood, [string, string]> = {
  idle:      ['M 74,88 Q 87,83 100,87',  'M 140,87 Q 153,83 166,88'],
  talking:   ['M 72,84 Q 86,78 100,83',  'M 140,83 Q 154,78 168,84'],
  excited:   ['M 70,80 Q 85,73 100,78',  'M 140,78 Q 155,73 170,80'],
  concerned: ['M 74,89 Q 87,94 100,89',  'M 140,89 Q 153,94 166,89'],
  thinking:  ['M 74,85 Q 87,80 100,84',  'M 140,87 Q 153,83 166,88'],
};

// Eye vertical scale [left, right]
const EYE_SY: Record<RockMood, [number, number]> = {
  idle:      [1.00, 1.00],
  talking:   [1.05, 1.05],
  excited:   [1.20, 1.20],
  concerned: [0.85, 0.85],
  thinking:  [1.00, 0.55],
};

function eye(cx: number, cy: number, sy: number): string {
  return `<g transform="translate(${cx},${cy}) scale(1,${sy}) translate(${-cx},${-cy})">
    <ellipse cx="${cx}" cy="${cy}" rx="17" ry="19" fill="#f4f1ec" stroke="#a8a49e" stroke-width="1.5"/>
    <ellipse cx="${cx + 2}" cy="${cy + 2}" rx="11" ry="12" fill="#28221e"/>
    <ellipse cx="${cx + 2}" cy="${cy + 2}" rx="5.5" ry="6" fill="#100e0c"/>
    <circle  cx="${cx - 2}" cy="${cy - 5}" r="3.5" fill="white"/>
  </g>`;
}

function mouth(mood: RockMood): string {
  switch (mood) {
    case 'talking':
      return `<ellipse cx="120" cy="167" rx="17" ry="12" fill="#2a2520"/>
              <ellipse cx="120" cy="164" rx="14" ry="8"  fill="#7d1f18"/>`;
    case 'excited':
      return `<path d="M 90,158 Q 120,186 150,158 L 148,166 Q 120,182 92,166 Z" fill="#2a2520"/>
              <path d="M 93,162 Q 120,183 147,162 L 145,166 Q 120,180 95,166 Z" fill="#8b2020"/>
              <path d="M 97,167 Q 120,175 143,167" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    case 'concerned':
      return `<path d="M 102,168 Q 120,158 138,168" stroke="#3a3530" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case 'thinking':
      return `<path d="M 104,165 Q 115,171 128,165 Q 136,161 143,167" stroke="#3a3530" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    default: // idle
      return `<path d="M 102,163 Q 120,177 138,163" stroke="#3a3530" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
}

/** Returns a full SVG string for the given mood, rendered at the given pixel size.
 *  @param mouthOpen  When provided, overrides which mouth variant is drawn (true = open, false = closed smile).
 *                    Useful for alternating talking frames without changing brows/eyes.
 */
export function buildRockSvg(mood: RockMood, width = 360, mouthOpen?: boolean): string {
  const height = Math.round(width * 260 / 240);
  const [lbrow, rbrow] = BROWS[mood];
  const [lsy, rsy]     = EYE_SY[mood];

  // If mouthOpen is explicitly provided, use 'talking' (open) or 'idle' (closed smile)
  // while keeping the current mood's brows/eyes intact.
  const mouthMood: RockMood =
    mouthOpen === true  ? 'talking' :
    mouthOpen === false ? 'idle'    : mood;

  return `<svg viewBox="0 0 240 260" width="${width}" height="${height}"
    xmlns="http://www.w3.org/2000/svg" style="background:transparent">
  <defs>
    <radialGradient id="rg" cx="38%" cy="28%" r="65%">
      <stop offset="0%"   stop-color="#d4cfc6"/>
      <stop offset="55%"  stop-color="#aeaaa2"/>
      <stop offset="100%" stop-color="#7a7872"/>
    </radialGradient>
    <filter id="ds" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#00000025"/>
    </filter>
  </defs>

  <ellipse cx="120" cy="232" rx="62" ry="10" fill="rgba(0,0,0,0.09)"/>

  <path d="M 55,168 C 28,148 20,108 35,72 C 50,38 85,20 122,18 C 160,16 195,38 210,72 C 225,106 218,152 195,178 C 175,200 148,215 118,215 C 88,215 68,195 55,168 Z"
    fill="url(#rg)" stroke="#68635e" stroke-width="2" filter="url(#ds)"/>

  <ellipse cx="93" cy="68" rx="35" ry="22" fill="rgba(255,255,255,0.13)" transform="rotate(-22 93 68)"/>

  <path d="M 64,96  Q 70,112 67,130"    stroke="#5a5854" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>
  <path d="M 162,50 Q 168,62  165,76"   stroke="#5a5854" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>
  <path d="M 178,150 Q 184,160 180,172" stroke="#5a5854" stroke-width="1"   fill="none" stroke-linecap="round" opacity="0.4"/>

  <path d="${lbrow}" stroke="#302c28" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <path d="${rbrow}" stroke="#302c28" stroke-width="4.5" fill="none" stroke-linecap="round"/>

  ${eye(88,  108, lsy)}
  ${eye(152, 108, rsy)}

  ${mouth(mouthMood)}
</svg>`;
}
