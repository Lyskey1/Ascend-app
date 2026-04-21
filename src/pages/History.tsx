import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronRight, Clock, Dumbbell, Trash2, Pencil } from 'lucide-react';
import { format, isAfter, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useSessions, useTemplates, updateSession } from '@/hooks/useWorkout';
import { trashSession, restoreFromTrash } from '@/hooks/useTrash';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SESSION_TAG_LABELS, SESSION_TAG_COLORS, type WorkoutSession } from '@/db/types';

type DateFilter = '7d' | '30d' | '90d' | 'all';

// ─── Main component ─────────────────────────────────────

export function History() {
  const navigate = useNavigate();
  const sessions = useSessions();
  const templates = useTemplates();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Delete state
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<WorkoutSession | null>(null);
  const [undoTrashId, setUndoTrashId] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit state
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDurationH, setEditDurationH] = useState('');
  const [editDurationM, setEditDurationM] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const filtered = useMemo(() => {
    let result = sessions;

    // Date filter
    if (dateFilter !== 'all') {
      const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
      const cutoff = subDays(new Date(), days);
      result = result.filter((s) => isAfter(new Date(s.startedAt), cutoff));
    }

    // Template filter
    if (templateFilter !== 'all') {
      result = result.filter((s) => s.templateId === templateFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.templateName.toLowerCase().includes(q) ||
          s.exercises.some((e) => e.exerciseName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [sessions, dateFilter, templateFilter, search]);

  // Summary: workout frequency by template name
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of filtered) {
      counts[s.templateName] = (counts[s.templateName] || 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [filtered]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const session of filtered) {
      const dateKey = format(new Date(session.startedAt), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(session);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // ─── Delete handlers ──────────────────────────────

  const handleRequestDelete = useCallback((e: React.MouseEvent, session: WorkoutSession) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteConfirmSession(session);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmSession) return;
    const sessionToDelete = deleteConfirmSession;
    setDeleteConfirmSession(null);

    const trashId = await trashSession(sessionToDelete);

    // Clear any existing undo timer
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    // Set undo state
    setUndoTrashId(trashId);
    undoTimerRef.current = setTimeout(() => {
      setUndoTrashId(null);
      undoTimerRef.current = null;
    }, 5000);
  }, [deleteConfirmSession]);

  const handleUndo = useCallback(async () => {
    if (!undoTrashId) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;

    await restoreFromTrash(undoTrashId);
    setUndoTrashId(null);
  }, [undoTrashId]);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, []);

  // ─── Edit handlers ───────────────────────────────

  const handleRequestEdit = useCallback((e: React.MouseEvent, session: WorkoutSession) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingSession(session);
    setEditDate(format(new Date(session.startedAt), 'yyyy-MM-dd'));
    const durationMin = session.duration ? Math.round(session.duration / 60) : 0;
    setEditDurationH(String(Math.floor(durationMin / 60)));
    setEditDurationM(String(durationMin % 60));
    setEditNotes(session.notes ?? '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingSession) return;

    const originalDate = new Date(editingSession.startedAt);
    const timeStr = format(originalDate, 'HH:mm:ss');
    const newStartedAt = new Date(`${editDate}T${timeStr}`).toISOString();

    const durationSeconds = ((parseInt(editDurationH) || 0) * 60 + (parseInt(editDurationM) || 0)) * 60;

    const updated: WorkoutSession = {
      ...editingSession,
      startedAt: newStartedAt,
      duration: durationSeconds > 0 ? durationSeconds : editingSession.duration,
      notes: editNotes || undefined,
    };

    if (updated.completedAt && durationSeconds > 0) {
      updated.completedAt = new Date(
        new Date(newStartedAt).getTime() + durationSeconds * 1000
      ).toISOString();
    }

    await updateSession(updated);
    setEditingSession(null);
  }, [editingSession, editDate, editDurationH, editDurationM, editNotes]);

  return (
    <div className="px-4 pt-14 pb-4">
      <h1 className="mb-4 text-2xl font-bold text-zinc-50">History</h1>

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search workouts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
          />
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className={`rounded-xl border p-2.5 ${
            dateFilter !== 'all' || templateFilter !== 'all'
              ? 'border-white/20 bg-white/5 text-white'
              : 'border-zinc-800 text-zinc-500 active:text-zinc-300'
          }`}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* Date filter pills */}
      <div className="mb-4 flex gap-2">
        {(['all', '7d', '30d', '90d'] as DateFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              dateFilter === f
                ? 'bg-white text-zinc-900'
                : 'bg-zinc-800/50 text-zinc-500 active:text-zinc-300'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* ─── Workout frequency summary ─────────────── */}
      {summary.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {summary.map(([name, count]) => (
            <div
              key={name}
              className="flex items-center gap-1.5 rounded-full border border-zinc-800/50 bg-zinc-900/30 px-2.5 py-1"
            >
              <span className="text-[11px] text-zinc-400 truncate max-w-[140px]">{name}</span>
              <span className="text-[11px] font-bold text-zinc-200">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-10 w-10" />}
          title="No workouts found"
          description={search ? 'Try a different search term' : 'Complete your first workout to see history'}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, daySessions]) => (
            <div key={dateKey}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {format(new Date(dateKey), 'EEEE, MMM d')}
              </p>
              <div className="space-y-2">
                {daySessions.map((session) => {
                  const totalVolume = session.exercises.reduce(
                    (acc, ex) =>
                      acc + ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
                    0
                  );
                  return (
                    <button
                      key={session.id}
                      onClick={() => navigate(`/history/${session.id}`)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800/50 bg-zinc-900/30 px-4 py-3.5 text-left active:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-200 truncate">{session.templateName}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.duration ? `${Math.round(session.duration / 60)} min` : '—'}
                          </span>
                          <span>{session.exercises.length} exercises</span>
                          <span>{totalVolume > 0 ? `${Math.round(totalVolume)} kg` : ''}</span>
                        </div>
                        {session.tags.length > 0 && (
                          <div className="mt-1.5 flex gap-1 flex-wrap">
                            {session.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SESSION_TAG_COLORS[tag]}`}
                              >
                                {SESSION_TAG_LABELS[tag]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleRequestEdit(e, session)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleRequestEdit(e as unknown as React.MouseEvent, session); } }}
                        className="rounded-lg p-2 -mr-1 text-zinc-700 hover:text-zinc-300 active:text-zinc-300 hover:bg-zinc-800/60 active:bg-zinc-800/60 transition-colors flex-shrink-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleRequestDelete(e, session)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleteConfirmSession(session); } }}
                        className="rounded-lg p-2 -mr-1 text-zinc-700 hover:text-red-400 active:text-red-400 hover:bg-zinc-800/60 active:bg-zinc-800/60 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-600 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter sheet */}
      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="Filters">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-500">Workout Template</label>
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-sm text-zinc-100 outline-none"
            >
              <option value="all">All templates</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              setDateFilter('all');
              setTemplateFilter('all');
              setSearch('');
              setShowFilters(false);
            }}
            className="text-sm font-medium text-zinc-400 active:text-zinc-200"
          >
            Reset all filters
          </button>
        </div>
      </Sheet>

      {/* ─── Edit session sheet ───────────────────────── */}
      <Sheet
        open={editingSession !== null}
        onClose={() => setEditingSession(null)}
        title="Edit Workout"
      >
        {editingSession && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-zinc-300">{editingSession.templateName}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">Duration</label>
              <div className="mt-1 flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={5}
                    placeholder="0"
                    value={editDurationH}
                    onChange={(e) => setEditDurationH(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 pr-16 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">hours</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    placeholder="0"
                    value={editDurationM}
                    onChange={(e) => setEditDurationM(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 pr-12 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">min</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Session notes..."
                rows={2}
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 resize-none"
              />
            </div>

            <Button variant="primary" fullWidth size="lg" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        )}
      </Sheet>

      {/* ─── Delete confirmation modal ─────────────────── */}
      <AnimatePresence>
        {deleteConfirmSession && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
              onClick={() => setDeleteConfirmSession(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-[110] inset-0 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50">
                <h3 className="text-base font-semibold text-zinc-100">Delete workout?</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Your <span className="font-medium text-zinc-300">{deleteConfirmSession.templateName}</span> session
                  from {format(new Date(deleteConfirmSession.startedAt), 'MMM d, yyyy')} will be moved to Trash.
                </p>
                <div className="mt-4 flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setDeleteConfirmSession(null)}>Cancel</Button>
                  <Button variant="danger" fullWidth onClick={handleConfirmDelete}>Delete</Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Undo toast ────────────────────────────────── */}
      <AnimatePresence>
        {undoTrashId && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-24 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-zinc-700/50 bg-zinc-800 px-4 py-3.5 shadow-xl shadow-black/50"
          >
            <Trash2 className="h-4 w-4 text-zinc-500 flex-shrink-0" />
            <p className="flex-1 text-sm text-zinc-300">Moved to Trash</p>
            <button
              onClick={handleUndo}
              className="rounded-lg bg-zinc-700/50 px-3 py-1.5 text-sm font-semibold text-blue-400 active:text-blue-300 transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
