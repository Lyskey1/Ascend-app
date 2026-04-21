import { useTemplates } from '@/hooks/useWorkout';
import { Sheet } from '@/components/ui/Sheet';
import { CATEGORY_LABELS } from '@/db/types';
import { Dumbbell, ChevronRight } from 'lucide-react';

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

const categoryIcons: Record<string, string> = {
  upper_push: '💪',
  upper_pull: '🏋️',
  legs: '🦵',
  shoulders: '🔥',
  cardio: '❤️',
  full_body: '⚡',
};

export function TemplateSelector({ open, onClose, onSelect }: TemplateSelectorProps) {
  const templates = useTemplates();

  return (
    <Sheet open={open} onClose={onClose} title="Choose Workout">
      <div className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => {
              onSelect(template.id);
              onClose();
            }}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 px-4 py-4 text-left active:bg-zinc-800/50 transition-colors"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800/80 text-lg">
              {template.emoji ?? categoryIcons[template.category] ?? '🏋️'}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-zinc-100">{template.name}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {CATEGORY_LABELS[template.category]}
                </span>
                {template.day && template.day.length > 0 && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-600">{template.day.join(', ')}</span>
                  </>
                )}
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-zinc-600">
                  {template.exercises.length} exercises
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </button>
        ))}

        {templates.length === 0 && (
          <div className="py-8 text-center">
            <Dumbbell className="mx-auto h-8 w-8 text-zinc-700" />
            <p className="mt-2 text-sm text-zinc-500">No templates yet</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
