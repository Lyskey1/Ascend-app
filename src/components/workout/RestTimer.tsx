import { useTimer } from '@/hooks/useTimer';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, forwardRef, useImperativeHandle } from 'react';

export interface RestTimerHandle {
  start: (seconds: number) => void;
}

interface RestTimerProps {
  defaultSeconds: number;
  persistKey?: string;
  onComplete?: () => void;
}

export const RestTimer = forwardRef<RestTimerHandle, RestTimerProps>(
  function RestTimer({ defaultSeconds, persistKey, onComplete }, ref) {
    const { seconds, isRunning, isComplete, progress, start, pause, resume, reset, skip } =
      useTimer(defaultSeconds, persistKey);

    useImperativeHandle(ref, () => ({
      start: (secs: number) => start(secs),
    }));

    useEffect(() => {
      if (isComplete && onComplete) {
        onComplete();
      }
    }, [isComplete, onComplete]);

    const formatTime = (s: number) => {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <AnimatePresence>
        {(isRunning || (seconds > 0 && seconds < defaultSeconds)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex items-center gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/80 px-4 py-3"
          >
            {/* Circular progress */}
            <div className="relative h-14 w-14 flex-shrink-0">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-zinc-800"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="text-white transition-all duration-1000"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-zinc-100">
                {formatTime(seconds)}
              </span>
            </div>

            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-500">Rest Timer</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => (isRunning ? pause() : resume())}
                className="rounded-full p-2 text-zinc-400 active:bg-zinc-800 active:text-zinc-200"
              >
                {isRunning ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={reset}
                className="rounded-full p-2 text-zinc-400 active:bg-zinc-800 active:text-zinc-200"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={skip}
                className="rounded-full p-2 text-zinc-400 active:bg-zinc-800 active:text-zinc-200"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
