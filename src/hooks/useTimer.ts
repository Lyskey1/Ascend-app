import { useState, useEffect, useCallback, useRef } from 'react';

export function useTimer(initialSeconds: number = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetRef = useRef(initialSeconds);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setIsRunning(false);
            setIsComplete(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
            // Vibrate on complete
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds]);

  const start = useCallback((secs?: number) => {
    const target = secs ?? targetRef.current;
    targetRef.current = target;
    setSeconds(target);
    setIsComplete(false);
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (seconds > 0) setIsRunning(true);
  }, [seconds]);

  const reset = useCallback(() => {
    setSeconds(targetRef.current);
    setIsRunning(false);
    setIsComplete(false);
  }, []);

  const skip = useCallback(() => {
    setSeconds(0);
    setIsRunning(false);
    setIsComplete(true);
  }, []);

  const progress = targetRef.current > 0 ? 1 - seconds / targetRef.current : 0;

  return { seconds, isRunning, isComplete, progress, start, pause, resume, reset, skip };
}
