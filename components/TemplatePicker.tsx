'use client';

const TEMPLATES = [
  { id: 'Organic Raw',    label: 'Organic Raw',    description: 'Camera roll candid, natural light', gradient: 'from-neutral-600 via-stone-500 to-neutral-400', badge: 'NEW' },
  { id: 'Dark Cinematic', label: 'Dark Cinematic', description: 'High-contrast, dramatic black tones', gradient: 'from-gray-950 via-gray-900 to-black' },
  { id: 'Moody Warm',     label: 'Moody Warm',     description: 'Rich amber and deep burgundy',       gradient: 'from-red-950 via-orange-950 to-stone-950' },
  { id: 'Grain Noir',     label: 'Grain Noir',     description: 'Heavy grain, classic black & white', gradient: 'from-zinc-950 via-zinc-900 to-neutral-950' },
  { id: 'Winter Arc',     label: 'Winter Arc',     description: 'Cold blues, icy and focused',        gradient: 'from-blue-950 via-slate-900 to-indigo-950' },
  { id: 'Dark Academia',  label: 'Dark Academia',  description: 'Earthy, scholarly, warm shadows',    gradient: 'from-yellow-950 via-stone-900 to-amber-950' },
];

interface Props { value: string; onChange: (id: string) => void; }

export default function TemplatePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {TEMPLATES.map(t => {
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left transition-all border
              ${selected
                ? 'bg-gray-900 border-gray-900 shadow-sm'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            {/* Colour swatch */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${t.gradient}`} />

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold leading-tight ${selected ? 'text-white' : 'text-gray-900'}`}>
                {t.label}
              </div>
              <div className={`text-xs leading-tight mt-0.5 truncate ${selected ? 'text-gray-400' : 'text-gray-400'}`}>
                {t.description}
              </div>
            </div>

            {/* Badge / checkmark */}
            {selected ? (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            ) : 'badge' in t && t.badge ? (
              <span className="flex-shrink-0 bg-gray-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider">{t.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
