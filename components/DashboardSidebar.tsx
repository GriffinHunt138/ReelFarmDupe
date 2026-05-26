'use client';

import StabilityRock from '@/components/StabilityRock';

export type Section =
  | 'slideshows'
  | 'mascot'
  | 'memes'
  | 'library'
  | 'queue'
  | 'performance';

interface Props {
  section: Section;
  onSelect: (s: Section) => void;
  libraryCount: number;
  queuePending: number;
}

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
  soon?: boolean;
}

function NavItem({ label, icon, active, onClick, badge, soon }: NavItemProps) {
  return (
    <button
      onClick={soon ? undefined : onClick}
      disabled={soon}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors
        ${active
          ? 'bg-white/10 text-white'
          : soon
            ? 'text-gray-700 cursor-default'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
    >
      <span className="flex-shrink-0 w-4 flex items-center justify-center opacity-80">
        {icon}
      </span>
      <span className="flex-1 font-medium truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="flex-shrink-0 text-[10px] font-bold bg-white/15 text-gray-300 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {badge}
        </span>
      )}
      {soon && (
        <span className="flex-shrink-0 text-[9px] font-bold text-gray-700 border border-gray-700 rounded px-1 py-0.5">
          SOON
        </span>
      )}
    </button>
  );
}

// Simple SVG icons
function IconSlides() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <rect x="1" y="3" width="14" height="3" rx="1" opacity="0.5"/>
      <rect x="1" y="7.5" width="14" height="3" rx="1" opacity="0.75"/>
      <rect x="1" y="12" width="14" height="3" rx="1"/>
    </svg>
  );
}

function IconLibrary() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path d="M2 2h3v12H2zM6.5 2h3v12h-3zM11 2h3v12h-3z" opacity="0.8"/>
    </svg>
  );
}

function IconQueue() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path d="M1 3h14v2H1zM1 7h10v2H1zM1 11h12v2H1z"/>
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <rect x="1" y="9" width="3" height="6" rx="0.5"/>
      <rect x="6" y="5" width="3" height="10" rx="0.5"/>
      <rect x="11" y="2" width="3" height="13" rx="0.5"/>
    </svg>
  );
}

function IconMeme() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <circle cx="8" cy="8" r="7" fillOpacity="0" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="5.5" cy="6.5" r="1"/>
      <circle cx="10.5" cy="6.5" r="1"/>
      <path d="M5 10.5 Q8 13 11 10.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

export default function DashboardSidebar({ section, onSelect, libraryCount, queuePending }: Props) {
  return (
    <aside className="w-52 flex-shrink-0 bg-[#111111] flex flex-col h-full border-r border-white/[0.04]">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black font-black text-xs leading-none">RF</span>
          </div>
          <div>
            <div className="text-white font-bold tracking-tight text-sm leading-tight">Faceless</div>
            <div className="text-gray-600 text-[9px] uppercase tracking-wider">Content Engine</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">

        {/* Create */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 px-3 mb-1.5">
            Create
          </p>
          <div className="space-y-0.5">
            <NavItem
              label="Slideshows"
              icon={<IconSlides />}
              active={section === 'slideshows'}
              onClick={() => onSelect('slideshows')}
            />
            <NavItem
              label="Mascot Videos"
              icon={<StabilityRock mood="idle" size={16} />}
              active={section === 'mascot'}
              onClick={() => onSelect('mascot')}
            />
            <NavItem
              label="Memes"
              icon={<IconMeme />}
              active={section === 'memes'}
              onClick={() => onSelect('memes')}
              soon
            />
          </div>
        </div>

        {/* Manage */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 px-3 mb-1.5">
            Manage
          </p>
          <div className="space-y-0.5">
            <NavItem
              label="Library"
              icon={<IconLibrary />}
              active={section === 'library'}
              onClick={() => onSelect('library')}
              badge={libraryCount}
            />
            <NavItem
              label="Queue"
              icon={<IconQueue />}
              active={section === 'queue'}
              onClick={() => onSelect('queue')}
              badge={queuePending}
            />
          </div>
        </div>

        {/* Analyze */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 px-3 mb-1.5">
            Analyze
          </p>
          <div className="space-y-0.5">
            <NavItem
              label="Performance"
              icon={<IconChart />}
              active={section === 'performance'}
              onClick={() => onSelect('performance')}
              soon
            />
          </div>
        </div>

      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-gray-700">Stability · Backpain App</p>
      </div>
    </aside>
  );
}
