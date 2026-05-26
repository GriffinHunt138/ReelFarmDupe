'use client';

import { useId } from 'react';

export type RockMood    = 'idle' | 'talking' | 'excited' | 'concerned' | 'thinking';
export type RockCostume = 'plain' | 'mustache' | 'beret' | 'tophat' | 'sunglasses';

export const ALL_COSTUMES: RockCostume[] = ['plain', 'mustache', 'beret', 'tophat', 'sunglasses'];

export function randomCostume(): RockCostume {
  return ALL_COSTUMES[Math.floor(Math.random() * ALL_COSTUMES.length)];
}

interface Props {
  mood?:    RockMood;
  costume?: RockCostume;
  size?:    number;
  animate?: boolean;
  className?: string;
}

// Eyebrow paths [left, right] per mood
const BROWS: Record<RockMood, [string, string]> = {
  idle:      ['M 74,88 Q 87,83 100,87',  'M 140,87 Q 153,83 166,88'],
  talking:   ['M 72,84 Q 86,78 100,83',  'M 140,83 Q 154,78 168,84'],
  excited:   ['M 70,80 Q 85,73 100,78',  'M 140,78 Q 155,73 170,80'],
  concerned: ['M 74,89 Q 87,94 100,89',  'M 140,89 Q 153,94 166,89'],
  thinking:  ['M 74,85 Q 87,80 100,84',  'M 140,87 Q 153,83 166,88'],
};

// Vertical eye scale [left, right]
const EYE_SY: Record<RockMood, [number, number]> = {
  idle:      [1.00, 1.00],
  talking:   [1.05, 1.05],
  excited:   [1.20, 1.20],
  concerned: [0.85, 0.85],
  thinking:  [1.00, 0.55],
};

function Eye({ cx, cy, sy }: { cx: number; cy: number; sy: number }) {
  return (
    <g transform={`translate(${cx},${cy}) scale(1,${sy}) translate(${-cx},${-cy})`}>
      <ellipse cx={cx}     cy={cy}     rx={17}  ry={19} fill="#f4f1ec" stroke="#a8a49e" strokeWidth={1.5} />
      <ellipse cx={cx + 2} cy={cy + 2} rx={11}  ry={12} fill="#28221e" />
      <ellipse cx={cx + 2} cy={cy + 2} rx={5.5} ry={6}  fill="#100e0c" />
      <circle  cx={cx - 2} cy={cy - 5} r={3.5}          fill="white"   />
    </g>
  );
}

function Mouth({ mood }: { mood: RockMood }) {
  switch (mood) {
    case 'talking':
      return (
        <g>
          <ellipse cx={120} cy={167} rx={17} ry={12} fill="#2a2520" />
          <ellipse cx={120} cy={164} rx={14} ry={8}  fill="#7d1f18" />
        </g>
      );
    case 'excited':
      return (
        <g>
          <path d="M 90,158 Q 120,186 150,158 L 148,166 Q 120,182 92,166 Z" fill="#2a2520" />
          <path d="M 93,162 Q 120,183 147,162 L 145,166 Q 120,180 95,166 Z" fill="#8b2020" />
          <path d="M 97,167 Q 120,175 143,167" stroke="white" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'concerned':
      return <path d="M 102,168 Q 120,158 138,168" stroke="#3a3530" strokeWidth={3} fill="none" strokeLinecap="round" />;
    case 'thinking':
      return <path d="M 104,165 Q 115,171 128,165 Q 136,161 143,167" stroke="#3a3530" strokeWidth={2.5} fill="none" strokeLinecap="round" />;
    default:
      return <path d="M 102,163 Q 120,177 138,163" stroke="#3a3530" strokeWidth={3} fill="none" strokeLinecap="round" />;
  }
}

// ─── Costume accessories ────────────────────────────────────────────────────

function CostumeMustache() {
  return (
    <g>
      {/* Left half — sweeps out and curls */}
      <path
        d="M 121,151 C 115,158 103,160 97,154 C 92,148 95,141 102,146 C 109,151 117,153 121,151"
        fill="#2a1f0e"
      />
      {/* Right half — mirror */}
      <path
        d="M 119,151 C 125,158 137,160 143,154 C 148,148 145,141 138,146 C 131,151 123,153 119,151"
        fill="#2a1f0e"
      />
      {/* Hair texture lines */}
      <path d="M 102,147 C 108,153 115,154 119,151" stroke="#3d2e14" strokeWidth={1} fill="none" opacity={0.45}/>
      <path d="M 138,147 C 132,153 125,154 121,151" stroke="#3d2e14" strokeWidth={1} fill="none" opacity={0.45}/>
    </g>
  );
}

function CostumeBeret() {
  return (
    <g>
      {/* Drop shadow */}
      <ellipse cx="120" cy="51" rx="57" ry="11" fill="rgba(0,0,0,0.20)" transform="rotate(-8 120 51)"/>
      {/* Brim band lower */}
      <ellipse cx="117" cy="44" rx="55" ry="12" fill="#7b1818" transform="rotate(-8 117 44)"/>
      {/* Brim band upper face */}
      <ellipse cx="117" cy="40" rx="55" ry="10" fill="#9b2222" transform="rotate(-8 117 40)"/>
      {/* Puff body */}
      <ellipse cx="103" cy="21" rx="60" ry="25" fill="#c0392b" transform="rotate(-8 103 21)"/>
      {/* Subtle fold shading on puff */}
      <ellipse cx="120" cy="30" rx="42" ry="12" fill="rgba(0,0,0,0.10)" transform="rotate(-8 120 30)"/>
      {/* Highlight */}
      <ellipse cx="85" cy="11" rx="24" ry="10" fill="rgba(255,255,255,0.18)" transform="rotate(-15 85 11)"/>
      {/* Stem */}
      <circle cx="81" cy="4" r="5.5" fill="#7b0e0e"/>
      <circle cx="81" cy="3" r="4"   fill="#b03a2e"/>
    </g>
  );
}

function CostumeTopHat() {
  return (
    <g>
      {/* Drop shadow under brim */}
      <ellipse cx="122" cy="52" rx="73" ry="12" fill="rgba(0,0,0,0.20)"/>
      {/* Brim underside */}
      <ellipse cx="120" cy="47" rx="70" ry="12" fill="#111"/>
      {/* Brim top face */}
      <ellipse cx="120" cy="43" rx="68" ry="10" fill="#222"/>
      {/* Cylinder body */}
      <rect x="74" y="5" width="92" height="40" rx="3" fill="#1c1c1c"/>
      {/* Cylinder top ellipse underside */}
      <ellipse cx="120" cy="5" rx="46" ry="8" fill="#1c1c1c"/>
      {/* Top cap */}
      <ellipse cx="120" cy="3" rx="46" ry="8" fill="#262626"/>
      {/* Hat band */}
      <rect x="74" y="33" width="92" height="10" rx="1" fill="#7b1818"/>
      {/* Band highlight */}
      <rect x="74" y="33" width="92" height="3" rx="1" fill="rgba(255,255,255,0.06)"/>
      {/* Brim edge highlight */}
      <ellipse cx="120" cy="43" rx="68" ry="10" fill="none" stroke="#303030" strokeWidth={1.5}/>
    </g>
  );
}

function CostumeSunglasses() {
  return (
    <g>
      {/* Left lens */}
      <rect x="63" y="93" width="50" height="30" rx="12" fill="#0d0d0d" opacity={0.92}/>
      <rect x="63" y="93" width="50" height="30" rx="12" fill="none" stroke="#787878" strokeWidth={1.8}/>
      {/* Right lens */}
      <rect x="127" y="93" width="50" height="30" rx="12" fill="#0d0d0d" opacity={0.92}/>
      <rect x="127" y="93" width="50" height="30" rx="12" fill="none" stroke="#787878" strokeWidth={1.8}/>
      {/* Bridge */}
      <path d="M 113,108 Q 120,102 127,108" stroke="#787878" strokeWidth={2} fill="none"/>
      {/* Left arm */}
      <path d="M 63,107 Q 51,105 44,110" stroke="#787878" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
      {/* Right arm */}
      <path d="M 177,107 Q 189,105 196,110" stroke="#787878" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
      {/* Lens reflections */}
      <ellipse cx="77"  cy="103" rx="10" ry="5" fill="white" opacity={0.10} transform="rotate(-20 77 103)"/>
      <ellipse cx="141" cy="103" rx="10" ry="5" fill="white" opacity={0.10} transform="rotate(-20 141 103)"/>
    </g>
  );
}

function CostumeLayer({ costume }: { costume: RockCostume }) {
  switch (costume) {
    case 'mustache':   return <CostumeMustache/>;
    case 'beret':      return <CostumeBeret/>;
    case 'tophat':     return <CostumeTopHat/>;
    case 'sunglasses': return <CostumeSunglasses/>;
    default:           return null;
  }
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function StabilityRock({
  mood = 'idle', costume = 'plain', size = 200, animate = false, className = '',
}: Props) {
  const rawId = useId();
  const uid   = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const gId   = `sr-g-${uid}`;
  const fId   = `sr-f-${uid}`;
  const aKey  = `sr-bob-${uid}`;

  const [lsy, rsy]     = EYE_SY[mood];
  const [lbrow, rbrow] = BROWS[mood];

  return (
    <svg
      viewBox="0 0 240 260"
      width={size}
      height={Math.round(size * 260 / 240)}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={animate && mood === 'idle' ? { animation: `${aKey} 2.8s ease-in-out infinite` } : undefined}
    >
      <defs>
        {animate && (
          <style>{`
            @keyframes ${aKey} {
              0%,100% { transform: translateY(0px);  }
              50%     { transform: translateY(-6px); }
            }
          `}</style>
        )}
        <radialGradient id={gId} cx="38%" cy="28%" r="65%">
          <stop offset="0%"   stopColor="#d4cfc6" />
          <stop offset="55%"  stopColor="#aeaaa2" />
          <stop offset="100%" stopColor="#7a7872" />
        </radialGradient>
        <filter id={fId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#00000025" />
        </filter>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="120" cy="232" rx="62" ry="10" fill="rgba(0,0,0,0.09)" />

      {/* Rock body */}
      <path
        d="M 55,168 C 28,148 20,108 35,72 C 50,38 85,20 122,18 C 160,16 195,38 210,72 C 225,106 218,152 195,178 C 175,200 148,215 118,215 C 88,215 68,195 55,168 Z"
        fill={`url(#${gId})`}
        stroke="#68635e"
        strokeWidth={2}
        filter={`url(#${fId})`}
      />

      {/* Specular highlight */}
      <ellipse cx="93" cy="68" rx="35" ry="22" fill="rgba(255,255,255,0.13)" transform="rotate(-22 93 68)" />

      {/* Crack lines */}
      <path d="M 64,96  Q 70,112 67,130"   stroke="#5a5854" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.6} />
      <path d="M 162,50 Q 168,62  165,76"  stroke="#5a5854" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.6} />
      <path d="M 178,150 Q 184,160 180,172" stroke="#5a5854" strokeWidth={1}   fill="none" strokeLinecap="round" opacity={0.4} />

      {/* Eyebrows */}
      <path d={lbrow} stroke="#302c28" strokeWidth={4.5} fill="none" strokeLinecap="round" />
      <path d={rbrow} stroke="#302c28" strokeWidth={4.5} fill="none" strokeLinecap="round" />

      {/* Eyes */}
      <Eye cx={88}  cy={108} sy={lsy} />
      <Eye cx={152} cy={108} sy={rsy} />

      {/* Mouth */}
      <Mouth mood={mood} />

      {/* Costume layer — rendered last so it sits on top */}
      <CostumeLayer costume={costume} />
    </svg>
  );
}
