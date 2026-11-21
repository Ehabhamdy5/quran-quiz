'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { generateQuestions, type GenerateState } from './actions';
import { DIFFICULTY_LABELS } from '@/lib/question-schema';
import { CATEGORY_NAMES, MAX_QUESTIONS } from '@/lib/generation';

const inputCls = 'w-full rounded border border-gray-300 bg-white p-2';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function GenerateForm() {
  const [state, setState] = useState<GenerateState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setState(await generateQuestions(null, fd)));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="max-w-3xl space-y-4 rounded border bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="رقم السورة">
            <input name="surah" type="number" min={1} max={114} required className={inputCls} />
          </Field>
          <Field label="من الآية">
            <input name="fromAyah" type="number" min={1} required className={inputCls} />
          </Field>
          <Field label="إلى الآية (خمس آيات على الأكثر)">
            <input name="toAyah" type="number" min={1} required className={inputCls} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="التصنيف">
            <select name="categoryId" defaultValue="1" className={inputCls}>
              {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المستوى">
            <select name="difficulty" defaultValue="beginner" className={inputCls}>
              {Object.entries(DIFFICULTY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="عدد الأسئلة">
            <input name="count" type="number" min={1} max={MAX_QUESTIONS} defaultValue={3} required className={inputCls} />
          </Field>
        </div>
        <button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
          {pending ? 'جارٍ جلب التفسير واقتراح الأسئلة… قد يستغرق دقيقة' : 'اقترح أسئلة'}
        </button>
      </form>

      {state?.errors.length ? (
        <ul className="list-disc rounded border border-red-300 bg-red-50 p-3 ps-8 text-red-800">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      {state?.created && (
        <section className="space-y-2">
          <h2 className="font-bold">مسودات حُفظت ({state.created.length})</h2>
          {state.created.length === 0 ? (
            <p className="text-sm text-gray-600">لم يجتز أي مقترح الفحص الآلي.</p>
          ) : (
            <ul className="list-disc space-y-1 ps-6">
              {state.created.map((q) => (
                <li key={q.id}>
                  <Link href={`/questions/${q.id}`} className="text-blue-800 hover:underline">
                    {q.prompt}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {state?.rejected && state.rejected.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">مقترحات رُفضت آليًا ({state.rejected.length})</h2>
          <ul className="space-y-1 text-sm">
            {state.rejected.map((r, i) => (
              <li key={i} className="rounded border bg-white p-2">
                <span className="text-gray-800">{r.prompt}</span>
                <span className="ms-2 text-red-700">({r.reason})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
