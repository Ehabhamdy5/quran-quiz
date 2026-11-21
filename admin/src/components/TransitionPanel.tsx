'use client';

import { useActionState } from 'react';
import { transitionQuestion } from '@/app/questions/actions';
import { ACTION_LABELS, type QuestionStatus } from '@/lib/status';

export function TransitionPanel({
  id,
  targets,
  generated = false,
}: {
  id: string;
  targets: QuestionStatus[];
  generated?: boolean;
}) {
  const [state, formAction, pending] = useActionState(transitionQuestion.bind(null, id), null);
  if (targets.length === 0) return null;

  return (
    <form action={formAction} className="space-y-2 rounded border bg-white p-4">
      {state?.errors.length ? <p className="text-sm text-red-700">{state.errors.join('، ')}</p> : null}
      {generated && targets.includes('approved') && (
        <p className="text-sm text-amber-800">سؤال مولَّد آليًا: طابِق الإجابة بالاقتباس والتفسير قبل الاعتماد.</p>
      )}
      {targets.includes('approved') && (
        <p className="text-sm text-gray-600">راجِع نص السؤال ومصدره وشاهد الوسائط أعلاه قبل الاعتماد.</p>
      )}
      {targets.includes('needs_changes') && (
        <textarea name="notes" rows={2} placeholder="ملاحظات المراجعة (مطلوبة عند الإعادة للتعديل)" className="w-full rounded border p-2" />
      )}
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button
            key={t}
            name="target"
            value={t}
            disabled={pending}
            className="rounded border border-gray-400 px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50"
          >
            {ACTION_LABELS[t]}
          </button>
        ))}
      </div>
    </form>
  );
}
