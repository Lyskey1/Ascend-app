import { useState, useEffect, useCallback, useRef } from 'react';

// Persisted shape — using endsAt makes the timer survive backgrounding and refresh:
// remaining time is always recomputed from Date.now(), so a paused JS timer can't
// drift it. paused holds the residual when the user pauses manually.
interface Persisted {
  total: number;
  endsAt: number | null;
  paused: number | null; // remaining seconds, when paused
}

function loadPersisted(key: string | undefined): Persisted | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (typeof parsed.total !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(key: string | undefined, state: Persisted | null) {
  if (!key) return;
  if (state === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(state));
}

function remainingFrom(state: Persisted): number {
  if (state.paused != null) return Math.max(0, state.paused);
  if (state.endsAt == null) return state.total;
  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
}

export function useTimer(initialSeconds: number = 0, persistKey?: string) {
  // Snapshot the starting state once. Never read this during render later — all
  // subsequent reads go through stateRef (mutated outside render).
  const [initialState] = useState<Persisted>(
    () => loadPersisted(persistKey) ?? { total: initialSeconds, endsAt: null, paused: null },
  );
  const stateRef = useRef<Persisted>(initialState);
  const [target, setTarget] = useState<number>(initialState.total);

  const [seconds, setSeconds] = useState<number>(() => remainingFrom(initialState));
  const [isRunning, setIsRunning] = useState<boolean>(
    () =>
      initialState.endsAt != null &&
      initialState.paused == null &&
      remainingFrom(initialState) > 0,
  );
  const [isComplete, setIsComplete] = useState<boolean>(
    () =>
      initialState.total > 0 &&
      initialState.endsAt != null &&
      remainingFrom(initialState) === 0,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedFiredRef = useRef(false);

  const tick = useCallback(() => {
    const state = stateRef.current;
    if (state.endsAt == null || state.paused != null) return;
    const remaining = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
    setSeconds(remaining);
    if (remaining <= 0) {
      setIsRunning(false);
      setIsComplete(true);
      if (!completedFiredRef.current) {
        completedFiredRef.current = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (isRunning && !intervalRef.current) {
      intervalRef.current = setInterval(tick, 500);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, tick]);

  // Recompute when the tab becomes visible again (mobile browsers throttle JS in
  // the background, so the interval may have stopped firing).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', tick);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', tick);
    };
  }, [tick]);

  const start = useCallback(
    (secs?: number) => {
      const nextTarget = secs ?? stateRef.current.total ?? initialSeconds;
      const next: Persisted = {
        total: nextTarget,
        endsAt: Date.now() + nextTarget * 1000,
        paused: null,
      };
      stateRef.current = next;
      writePersisted(persistKey, next);
      completedFiredRef.current = false;
      setTarget(nextTarget);
      setSeconds(nextTarget);
      setIsComplete(false);
      setIsRunning(true);
    },
    [persistKey, initialSeconds],
  );

  const pause = useCallback(() => {
    const state = stateRef.current;
    if (state.endsAt == null || state.paused != null) return;
    const remaining = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
    const next: Persisted = { total: state.total, endsAt: null, paused: remaining };
    stateRef.current = next;
    writePersisted(persistKey, next);
    setSeconds(remaining);
    setIsRunning(false);
  }, [persistKey]);

  const resume = useCallback(() => {
    const state = stateRef.current;
    if (state.paused == null || state.paused <= 0) return;
    const next: Persisted = {
      total: state.total,
      endsAt: Date.now() + state.paused * 1000,
      paused: null,
    };
    stateRef.current = next;
    writePersisted(persistKey, next);
    setIsRunning(true);
  }, [persistKey]);

  const reset = useCallback(() => {
    const t = stateRef.current.total;
    const next: Persisted = { total: t, endsAt: null, paused: null };
    stateRef.current = next;
    writePersisted(persistKey, null);
    setSeconds(t);
    setIsRunning(false);
    setIsComplete(false);
    completedFiredRef.current = false;
  }, [persistKey]);

  const skip = useCallback(() => {
    const t = stateRef.current.total;
    const next: Persisted = { total: t, endsAt: null, paused: 0 };
    stateRef.current = next;
    writePersisted(persistKey, null);
    setSeconds(0);
    setIsRunning(false);
    setIsComplete(true);
  }, [persistKey]);

  const progress = target > 0 ? 1 - seconds / target : 0;

  return { seconds, isRunning, isComplete, progress, start, pause, resume, reset, skip };
}
