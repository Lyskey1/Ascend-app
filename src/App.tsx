import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { ThemeProvider } from '@/hooks/useTheme';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedDatabase().then(() => syncExerciseLibrary()).then(() => setReady(true));
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
      </BrowserRouter>
    </ThemeProvider>
  );
}
