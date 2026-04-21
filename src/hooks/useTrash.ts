import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db } from '@/db/database';
import type {
  TrashItem,
  TrashItemType,
  WorkoutSession,
  WorkoutTemplate,
  Exercise,
  BodyweightEntry,
} from '@/db/types';
import { CATEGORY_LABELS, MUSCLE_GROUP_LABELS } from '@/db/types';

// ─── Program group types (mirrors Programs.tsx) ─────────

interface ProgramGroup {
  id: string;
  name: string;
  emoji?: string;
}

interface GroupLayout {
  groups: ProgramGroup[];
  assignments: Record<string, string>;
}

const LS_GROUP_LAYOUT = 'iron_program_groups';

function loadGroupLayout(): GroupLayout {
  try {
    const v = localStorage.getItem(LS_GROUP_LAYOUT);
    if (v) return JSON.parse(v);
  } catch { /* ignore */ }
  return { groups: [], assignments: {} };
}

function saveGroupLayout(layout: GroupLayout) {
  localStorage.setItem(LS_GROUP_LAYOUT, JSON.stringify(layout));
}

// ─── Core trash operations ──────────────────────────────

async function moveToTrash(
  itemType: TrashItemType,
  itemId: string,
  name: string,
  context: string | undefined,
  data: unknown,
): Promise<string> {
  const trashItem: TrashItem = {
    id: crypto.randomUUID(),
    itemType,
    itemId,
    name,
    context,
    data: JSON.stringify(data),
    deletedAt: new Date().toISOString(),
  };
  await db.trash.add(trashItem);
  return trashItem.id;
}

// ─── Typed trash functions ──────────────────────────────

export async function trashSession(session: WorkoutSession): Promise<string> {
  const context = [
    format(new Date(session.startedAt), 'MMM d, yyyy'),
    session.duration ? `${Math.round(session.duration / 60)} min` : null,
    `${session.exercises.length} exercises`,
  ].filter(Boolean).join(' · ');

  const trashId = await moveToTrash('session', session.id, session.templateName, context, session);
  await db.sessions.delete(session.id);
  return trashId;
}

export async function trashTemplate(template: WorkoutTemplate): Promise<string> {
  const context = [
    CATEGORY_LABELS[template.category],
    `${template.exercises.length} exercises`,
  ].join(' · ');

  const trashId = await moveToTrash('template', template.id, template.name, context, template);
  await db.templates.delete(template.id);

  // Clean up group assignment
  const layout = loadGroupLayout();
  if (layout.assignments[template.id]) {
    delete layout.assignments[template.id];
    saveGroupLayout(layout);
  }

  return trashId;
}

export async function trashExercise(exercise: Exercise): Promise<string> {
  const context = MUSCLE_GROUP_LABELS[exercise.primaryMuscle];
  const trashId = await moveToTrash('exercise', exercise.id, exercise.name, context, exercise);
  await db.exercises.delete(exercise.id);
  return trashId;
}

export async function trashBodyweightEntry(entry: BodyweightEntry): Promise<string> {
  const context = [
    format(new Date(entry.date), 'MMM d, yyyy'),
    entry.note || null,
  ].filter(Boolean).join(' · ');

  const trashId = await moveToTrash('bodyweight', entry.id, `${entry.weight} kg`, context, entry);
  await db.bodyweight.delete(entry.id);
  return trashId;
}

export async function trashProgramGroup(
  group: ProgramGroup,
  assignedTemplateIds: string[],
): Promise<string> {
  const context = assignedTemplateIds.length > 0
    ? `${assignedTemplateIds.length} program${assignedTemplateIds.length !== 1 ? 's' : ''}`
    : undefined;

  const trashId = await moveToTrash(
    'program_group',
    group.id,
    `${group.emoji ? group.emoji + ' ' : ''}${group.name}`,
    context,
    { group, assignedTemplateIds },
  );

  // Remove group from localStorage
  const layout = loadGroupLayout();
  const newAssignments = { ...layout.assignments };
  for (const tid of assignedTemplateIds) {
    delete newAssignments[tid];
  }
  saveGroupLayout({
    groups: layout.groups.filter((g) => g.id !== group.id),
    assignments: newAssignments,
  });

  return trashId;
}

// ─── Restore ────────────────────────────────────────────

export async function restoreFromTrash(trashId: string): Promise<boolean> {
  const item = await db.trash.get(trashId);
  if (!item) return false;

  const data = JSON.parse(item.data);

  switch (item.itemType) {
    case 'session':
      await db.sessions.put(data);
      break;
    case 'template':
      await db.templates.put(data);
      break;
    case 'exercise':
      await db.exercises.put(data);
      break;
    case 'bodyweight':
      await db.bodyweight.put(data);
      break;
    case 'program_group': {
      const { group, assignedTemplateIds } = data as { group: ProgramGroup; assignedTemplateIds: string[] };
      const layout = loadGroupLayout();
      // Only add if not already present
      if (!layout.groups.some((g) => g.id === group.id)) {
        layout.groups.push(group);
      }
      // Re-assign templates that still exist
      const existingTemplates = await db.templates.toArray();
      const existingIds = new Set(existingTemplates.map((t) => t.id));
      for (const tid of assignedTemplateIds) {
        if (existingIds.has(tid)) {
          layout.assignments[tid] = group.id;
        }
      }
      saveGroupLayout(layout);
      break;
    }
  }

  await db.trash.delete(trashId);
  return true;
}

// ─── Permanent delete ───────────────────────────────────

export async function permanentlyDelete(trashId: string) {
  await db.trash.delete(trashId);
}

export async function emptyTrash() {
  await db.trash.clear();
}

// ─── Hooks ──────────────────────────────────────────────

export function useTrashItems() {
  return useLiveQuery(
    () => db.trash.orderBy('deletedAt').reverse().toArray()
  ) ?? [];
}

export function useTrashCount() {
  return useLiveQuery(() => db.trash.count()) ?? 0;
}
