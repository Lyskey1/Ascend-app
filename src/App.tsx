import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Programs } from '@/pages/Programs';
import { LiveWorkout } from '@/pages/LiveWorkout';
import { History } from '@/pages/History';
import { HistoryDetail } from '@/pages/HistoryDetail';
import { BodyweightPage } from '@/pages/Bodyweight';
import { HealthPage } from '@/pages/Health';
import { StepsPage } from '@/pages/Steps';
import { SleepPage } from '@/pages/Sleep';
import { Stats } from '@/pages/Stats';
import { TrashPage } from '@/pages/Trash';
import { WeeklyRecap } from '@/pages/WeeklyRecap';
import { Settings } from '@/pages/Settings';
import { seedDatabase } from '@/db/seed';
import { syncExerciseLibrary } from '@/db/database';
import { runHealthSync } from '@/services/healthSync';
import { ThemeProvider } from '@/hooks/useTheme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await seedDatabase();
      await syncExerciseLibrary();
      try {
        const result = await runHealthSync();
        if (result.status === 'synced') {
          setSyncToast(result.updated ? 'Updated from Apple Health' : 'Synced from Apple Health');
          setTimeout(() => setSyncToast(null), 4000);
        }
      } catch (err) {
        console.warn('[healthsync] Sync failed:', err);
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100">ASCEND</h1>
          <p className="mt-2 text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<HistoryDetail />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/bodyweight" element={<BodyweightPage />} />
            <Route path="/steps" element={<StepsPage />} />
            <Route path="/sleep" element={<SleepPage />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/recap" element={<WeeklyRecap />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/workout/:id" element={<LiveWorkout />} />
        </Routes>

        <AnimatePresence>
          {syncToast && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="fixed bottom-24 left-4 right-4 z-[200] mx-auto max-w-lg"
            >
              <div className="flex items-center gap-3 rounded-2xl border border-positive/30 bg-positive/10 px-4 py-3.5 text-positive shadow-xl">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                <p className="flex-1 text-sm font-medium">{syncToast}</p>
                <button onClick={() => setSyncToast(null)} className="flex-shrink-0 p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </BrowserRouter>
    </ThemeProvider>
  );
}
