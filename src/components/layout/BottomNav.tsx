import { NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Clock, Heart, BarChart3, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const links = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/programs', icon: Dumbbell, label: 'Programs' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/health', icon: Heart, label: 'Health', matchPaths: ['/health', '/bodyweight', '/steps', '/sleep'] },
  { to: '/stats', icon: BarChart3, label: 'Stats' },
];

export function BottomNav() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-center gap-2 pt-1.5">
        <p className="text-center text-[9px] tracking-wide text-zinc-600">
          Made by{' '}
          <a
            href="https://x.com/Lyskey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Lyskey
          </a>
        </p>
        <span className="text-zinc-800">·</span>
        <button
          onClick={toggleTheme}
          className="text-zinc-600 active:text-zinc-300 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
        </button>
      </div>
      <div className="mx-auto flex max-w-lg items-center justify-around pb-[env(safe-area-inset-bottom)] px-2">
        {links.map(({ to, icon: Icon, label, matchPaths }) => {
          const active = matchPaths
            ? matchPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))
            : location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={
                `flex flex-col items-center gap-0.5 px-3 py-2.5 text-[10px] font-medium transition-colors ${
                  active
                    ? 'text-white'
                    : 'text-zinc-500 active:text-zinc-300'
                }`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
