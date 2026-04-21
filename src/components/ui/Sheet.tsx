import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useIsDesktop } from '@/hooks/useMediaQuery';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function Sheet({ open, onClose, children, title }: SheetProps) {
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const content = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {isDesktop ? (
            /* ─── Desktop: centered modal ─── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-925 shadow-2xl shadow-black/50">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/50 px-6 py-4 flex-shrink-0">
                  <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
                  <button
                    onClick={onClose}
                    className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
              </div>
            </motion.div>
          ) : (
            /* ─── Mobile: bottom sheet ─── */
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[100] max-h-[90dvh] flex flex-col rounded-t-3xl border-t border-zinc-800 bg-zinc-925 pb-[env(safe-area-inset-bottom)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/50 bg-zinc-925 px-5 py-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-zinc-400 active:bg-zinc-800 active:text-zinc-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );

  // Portal to document.body so it escapes any parent overflow/max-width constraints
  return createPortal(content, document.body);
}
