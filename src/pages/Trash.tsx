import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2, ArrowLeft, RotateCcw, Clock, Dumbbell, Scale,
  FolderOpen, AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useTrashItems,
  restoreFromTrash,
  permanentlyDelete,
  emptyTrash,
} from '@/hooks/useTrash';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { TrashItemType } from '@/db/types';

// ─── Helpers ────────────────────────────────────────────

type TypeFilter = 'all' | TrashItemType;

const TYPE_LABELS: Record<TrashItemType, string> = {
  session: 'Session',
  template: 'Program',
  exercise: 'Exercise',
  bodyweight: 'Weight',
  program_group: 'Group',
};

const TYPE_ICONS: Record<TrashItemType, typeof Clock> = {
  session: Clock,
  template: Dumbbell,
  exercise: Dumbbell,
  bodyweight: Scale,
  program_group: FolderOpen,
};

const TYPE_COLORS: Record<TrashItemType, string> = {
  session: 'bg-blue-500/15 text-blue-400',
  template: 'bg-purple-500/15 text-purple-400',
  exercise: 'bg-emerald-500/15 text-emerald-400',
  bodyweight: 'bg-amber-500/15 text-amber-400',
  program_group: 'bg-cyan-500/15 text-cyan-400',
};

const FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'session', label: 'Sessions' },
  { value: 'template', label: 'Programs' },
  { value: 'exercise', label: 'Exercises' },
  { value: 'bodyweight', label: 'Weight' },
  { value: 'program_group', label: 'Groups' },
];

// ─── Main component ─────────────────────────────────────

export function TrashPage() {
  const navigate = useNavigate();
  const items = useTrashItems();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return items;
    return items.filter((i) => i.itemType === typeFilter);
  }, [items, typeFilter]);

  // Only show filter types that have items
  const activeFilters = useMemo(() => {
    const types = new Set(items.map((i) => i.itemType));
    return FILTER_OPTIONS.filter((f) => f.value === 'all' || types.has(f.value as TrashItemType));
  }, [items]);

  const handleRestore = useCallback(async (trashId: string) => {
    await restoreFromTrash(trashId);
  }, []);

  const handlePermanentDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    await permanentlyDelete(confirmDeleteId);
    setConfirmDeleteId(null);
  }, [confirmDeleteId]);

  const handleEmptyTrash = useCallback(async () => {
    await emptyTrash();
    setShowEmptyConfirm(false);
  }, []);

  const confirmItem = items.find((i) => i.id === confirmDeleteId);

  return (
    <div className="px-4 pt-14 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl p-2 text-zinc-400 active:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-2xl font-bold text-zinc-50">Trash</h1>
        {items.length > 0 && (
          <button
            onClick={() => setShowEmptyConfirm(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 active:text-red-300 transition-colors"
          >
            Empty Trash
          </button>
        )}
      </div>

      {/* Type filter pills */}
      {activeFilters.length > 2 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {activeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                typeFilter === f.value
                  ? 'bg-white text-zinc-900'
                  : 'bg-zinc-800/50 text-zinc-500 active:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Trash list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="h-10 w-10" />}
          title="Trash is empty"
          description={items.length > 0 && typeFilter !== 'all' ? 'No items of this type' : 'Deleted items will appear here'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const Icon = TYPE_ICONS[item.itemType];
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 px-4 py-3.5"
              >
                <div className="flex items-start gap-3">
                  {/* Type badge */}
                  <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${TYPE_COLORS[item.itemType]}`}>
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.5} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-200 truncate">{item.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[item.itemType]}`}>
                        {TYPE_LABELS[item.itemType]}
                      </span>
                      {item.context && (
                        <span className="text-[11px] text-zinc-500 truncate">{item.context}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      Deleted {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleRestore(item.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-800/60 py-2 text-xs font-medium text-zinc-300 active:bg-zinc-700/60 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500/10 py-2 text-xs font-medium text-red-400 active:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Forever
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Permanent delete confirmation ─────────────── */}
      <AnimatePresence>
        {confirmDeleteId && confirmItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
              onClick={() => setConfirmDeleteId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-[110] inset-0 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50">
                <div className="flex items-center gap-2 text-red-400 mb-3">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-base font-semibold">Delete forever?</h3>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="font-medium text-zinc-300">{confirmItem.name}</span> will be
                  permanently deleted. This cannot be undone.
                </p>
                <div className="mt-4 flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                  <Button variant="danger" fullWidth onClick={handlePermanentDelete}>Delete Forever</Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Empty trash confirmation ──────────────────── */}
      <AnimatePresence>
        {showEmptyConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
              onClick={() => setShowEmptyConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-[110] inset-0 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50">
                <div className="flex items-center gap-2 text-red-400 mb-3">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-base font-semibold">Empty trash?</h3>
                </div>
                <p className="text-sm text-zinc-400">
                  All {items.length} item{items.length !== 1 ? 's' : ''} will be permanently deleted.
                  This cannot be undone.
                </p>
                <div className="mt-4 flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setShowEmptyConfirm(false)}>Cancel</Button>
                  <Button variant="danger" fullWidth onClick={handleEmptyTrash}>Empty Trash</Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
