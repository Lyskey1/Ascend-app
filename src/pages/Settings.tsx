import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Download, Upload, Sun, Moon, Shield, CheckCircle2,
  AlertTriangle, Loader2, FileDown, FileUp, Database, HardDrive,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';
import {
  createBackup, downloadBackup, validateBackup, restoreBackup,
  readFileAsJSON, type BackupFile, type ValidationResult,
} from '@/services/backup';
import { format } from 'date-fns';

// ─── Toast ──────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed bottom-24 left-4 right-4 z-[200] mx-auto max-w-lg"
    >
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-xl ${
          type === 'success'
            ? 'border-positive/30 bg-positive/10 text-positive'
            : 'border-negative/30 bg-negative/10 text-negative'
        }`}
      >
        {type === 'success' ? (
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        )}
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button onClick={onClose} className="flex-shrink-0 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main component ─────────────────────────────────────

export function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function showToast(message: string, type: 'success' | 'error') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  // ── Export ──────────────────────────────────────────

  async function handleExport() {
    setExporting(true);
    try {
      const backup = await createBackup();
      downloadBackup(backup);
      showToast('Backup exported successfully', 'success');
    } catch (err) {
      showToast(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setExporting(false);
    }
  }

  // ── Import ──────────────────────────────────────────

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    try {
      const data = await readFileAsJSON(file);
      const result = validateBackup(data);
      setValidation(result);
      setPendingFile(file);

      if (result.valid) {
        setShowImportConfirm(true);
      } else {
        showToast(result.error ?? 'Invalid backup file', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to read file', 'error');
    }
  }

  function handleImportCancel() {
    setShowImportConfirm(false);
    setShowFinalConfirm(false);
    setPendingFile(null);
    setValidation(null);
  }

  function handleProceedToFinal() {
    setShowImportConfirm(false);
    setShowFinalConfirm(true);
  }

  async function handleConfirmImport() {
    if (!pendingFile) return;
    setShowFinalConfirm(false);
    setImporting(true);

    try {
      // Create a safety backup before importing
      const safetyBackup = await createBackup();

      // Read and restore
      const data = await readFileAsJSON(pendingFile);
      const backup = data as BackupFile;

      try {
        await restoreBackup(backup);
        showToast('Data restored successfully. Refreshing...', 'success');
        // Give time to see the toast, then reload to reflect all changes
        setTimeout(() => window.location.reload(), 1500);
      } catch (restoreErr) {
        // Attempt to rollback using the safety backup
        try {
          await restoreBackup(safetyBackup);
          showToast('Import failed — your previous data has been restored.', 'error');
        } catch {
          showToast(
            `Import failed and rollback also failed. Error: ${restoreErr instanceof Error ? restoreErr.message : 'Unknown'}`,
            'error'
          );
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
      setPendingFile(null);
      setValidation(null);
    }
  }

  return (
    <div className="space-y-6 px-4 pt-14 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="rounded-full p-1 text-zinc-400 active:text-zinc-200">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-zinc-50">Settings</h1>
      </div>

      {/* Appearance */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Appearance</h2>
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 px-4 py-4 text-left active:bg-zinc-800/50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
            {theme === 'dark' ? <Moon className="h-5 w-5 text-accent" /> : <Sun className="h-5 w-5 text-warning" />}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-zinc-100">Theme</p>
            <p className="text-xs text-zinc-500">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
          </div>
          <div className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
            {theme === 'dark' ? 'Dark' : 'Light'}
          </div>
        </button>
      </section>

      {/* Data Management */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Data</h2>
        <div className="space-y-2.5">

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 px-4 py-4 text-left active:bg-zinc-800/50 transition-colors disabled:opacity-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-positive/15">
              {exporting ? (
                <Loader2 className="h-5 w-5 animate-spin text-positive" />
              ) : (
                <Download className="h-5 w-5 text-positive" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-zinc-100">Export Data</p>
              <p className="text-xs text-zinc-500">Download a full backup of all your data</p>
            </div>
            <FileDown className="h-4 w-4 text-zinc-600" />
          </button>

          {/* Import */}
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 px-4 py-4 text-left active:bg-zinc-800/50 transition-colors disabled:opacity-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
              {importing ? (
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
              ) : (
                <Upload className="h-5 w-5 text-accent" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-zinc-100">Import Data</p>
              <p className="text-xs text-zinc-500">Restore from a backup file</p>
            </div>
            <FileUp className="h-4 w-4 text-zinc-600" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
      </section>

      {/* Info */}
      <section>
        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
            <div>
              <p className="text-xs leading-relaxed text-zinc-400">
                Your data is stored locally on this device. Backups include all workouts, programs,
                bodyweight entries, health data, personal records, settings, and preferences.
              </p>
              <div className="mt-3 flex items-center gap-4 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" /> IndexedDB
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" /> localStorage
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Import confirmation modal (step 1) ─────── */}
      <AnimatePresence>
        {showImportConfirm && validation?.valid && validation.stats && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm"
              onClick={handleImportCancel}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 z-[150] mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-925 p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
                  <Upload className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100">Import Backup</h3>
                  <p className="text-xs text-zinc-500">
                    {format(new Date(validation.stats.createdAt), 'MMM d, yyyy · HH:mm')}
                  </p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                {[
                  { label: 'Exercises', value: validation.stats.exercises },
                  { label: 'Templates', value: validation.stats.templates },
                  { label: 'Sessions', value: validation.stats.sessions },
                  { label: 'Bodyweight', value: validation.stats.bodyweight },
                  { label: 'Records', value: validation.stats.records },
                  { label: 'Steps', value: validation.stats.steps },
                  { label: 'Sleep', value: validation.stats.sleep },
                  { label: 'Settings', value: validation.stats.localStorageKeys },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-zinc-900/50 px-3 py-2">
                    <p className="text-[10px] text-zinc-600">{label}</p>
                    <p className="text-sm font-semibold text-zinc-200">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mb-4 rounded-xl border border-warning/20 bg-warning/5 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
                  <p className="text-xs leading-relaxed text-warning/90">
                    This will replace all current data on this device. A safety backup will be created automatically before importing.
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={handleImportCancel}
                  className="flex-1 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 active:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedToFinal}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Final confirmation modal (step 2) ──────── */}
      <AnimatePresence>
        {showFinalConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm"
              onClick={handleImportCancel}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 z-[150] mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-925 p-5 shadow-2xl"
            >
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-negative/10">
                  <AlertTriangle className="h-7 w-7 text-negative" />
                </div>
              </div>
              <h3 className="mb-2 text-center text-lg font-bold text-zinc-100">Are you sure?</h3>
              <p className="mb-5 text-center text-sm text-zinc-400">
                All existing workouts, programs, health data, and settings will be permanently replaced with the backup data.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={handleImportCancel}
                  className="flex-1 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 active:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 rounded-xl bg-negative/15 px-4 py-2.5 text-sm font-semibold text-negative active:bg-negative/25 transition-colors"
                >
                  Replace All Data
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Importing overlay ──────────────────────── */}
      <AnimatePresence>
        {importing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
              <p className="mt-3 text-sm font-medium text-zinc-300">Restoring data...</p>
              <p className="mt-1 text-xs text-zinc-500">Do not close the app</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ──────────────────────────────────── */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
