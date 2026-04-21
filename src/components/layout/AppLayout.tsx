import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg sm:max-w-2xl lg:max-w-4xl bg-zinc-950">
      <main className="pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
