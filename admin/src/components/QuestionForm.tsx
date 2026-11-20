'use client';

import { useState, useTransition } from 'react';
import type { FormState } from '@/app/questions/actions';
import { TYPE_LABELS, DIFFICULTY_LABELS, type QuestionRow } from '@/lib/question-schema';
import type { Placement } from '@/lib/media';

const inputCls = 'w-full rounded border border-gray-300 bg-white p-2';

type Category = { id: number; name_ar: string };

export type MediaDefaults = {
  kind: 'image' | 'video';
  url: string;
  start_seconds: number | null;
  end_seconds: number | null;
  alt_text: string;
};

export type QuestionDefaults = QuestionRow & {
  media: { question: MediaDefaults | null; answer: MediaDefaults | null };
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function MediaFields({ placement, title, d }: { placement: Placement; title: string; d: MediaDefaults | null }) {
  const p = `${placement}_media_`;
  return (
    <fieldset className="space-y-2 rounded border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        <select name={`${p}kind`} defaultValue={d?.kind ?? 'video'} className={inputCls}>
          <option value="video">فيديو</option>
          <option value="image">صورة</option>
        </select>
        <input name={`${p}url`} defaultValue={d?.url ?? ''} placeholder="رابط https (اتركه فارغًا إن لم يوجد)" dir="ltr" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name={`${p}start`} type="number" min={0} defaultValue={d?.start_seconds ?? ''} placeholder="بداية اللقطة (ثانية)" className={inputCls} />
        <input name={`${p}end`} type="number" min={1} defaultValue={d?.end_seconds ?? ''} placeholder="نهاية اللقطة (ثانية)" className={inputCls} />
      </div>
      <input name={`${p}alt`} defaultValue={d?.alt_text ?? ''} placeholder="وصف نصي بديل يُعرض إن تعذّر التحميل" className={inputCls} />
    </fieldset>
  );
}

export function QuestionForm({
  categories,
  action,
  defaults,
}: {
  categories: Category[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: QuestionDefaults;
}) {
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>(defaults?.type ?? 'mcq');
  const options = defaults?.options ?? [];
  const correct = defaults?.correct_answer ?? null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setState(await action(null, fd)));
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-4">
      {state?.errors.length ? (
        <ul className="list-disc space-y-1 rounded border border-red-300 bg-red-50 p-3 ps-8 text-red-800">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      <Field label="نص السؤال">
        <textarea name="prompt" rows={3} required defaultValue={defaults?.prompt} className={inputCls} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="النوع">
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {Object.entries(TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="التصنيف">
          <select name="categoryId" required defaultValue={defaults?.category_id ?? ''} className={inputCls}>
            <option value="" disabled>
              اختر
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المستوى">
          <select name="difficulty" defaultValue={defaults?.difficulty ?? 'beginner'} className={inputCls}>
            {Object.entries(DIFFICULTY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {type === 'true_false' ? (
        <Field label="الإجابة الصحيحة">
          <select name="correct" defaultValue={correct === false ? 'false' : 'true'} className={inputCls}>
            <option value="true">صواب</option>
            <option value="false">خطأ</option>
          </select>
        </Field>
      ) : type === 'ordering' ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">العناصر بترتيبها الصحيح (من 3 إلى 6)</legend>
          {Array.from({ length: 6 }, (_, i) => (
            <input key={i} name="option" defaultValue={options[i] ?? ''} placeholder={`العنصر ${i + 1}`} className={inputCls} />
          ))}
        </fieldset>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">الخيارات (حدّد الصحيح)</legend>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" value={i} defaultChecked={correct === i} aria-label={`الخيار ${i + 1} هو الصحيح`} />
              <input name="option" defaultValue={options[i] ?? ''} placeholder={`الخيار ${i + 1}`} className={inputCls} />
            </div>
          ))}
        </fieldset>
      )}

      <Field label="الفائدة (تظهر بعد الإجابة)">
        <textarea name="benefit" rows={2} required defaultValue={defaults?.benefit} className={inputCls} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="المصدر">
          <input name="sourceBook" required defaultValue={defaults?.source_book} className={inputCls} />
        </Field>
        <Field label="الجزء">
          <input name="sourceVolume" defaultValue={defaults?.source_volume ?? ''} className={inputCls} />
        </Field>
        <Field label="الصفحة">
          <input name="sourcePage" required defaultValue={defaults?.source_page} className={inputCls} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="رقم السورة">
          <input name="surah" type="number" min={1} max={114} defaultValue={defaults?.surah ?? ''} className={inputCls} />
        </Field>
        <Field label="رقم الآية">
          <input name="ayah" type="number" min={1} defaultValue={defaults?.ayah ?? ''} className={inputCls} />
        </Field>
      </div>

      <MediaFields placement="question" title="وسيط مع السؤال" d={defaults?.media.question ?? null} />
      <MediaFields placement="answer" title="شرح مرئي مع الإجابة" d={defaults?.media.answer ?? null} />

      <button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'جارٍ الحفظ…' : 'حفظ'}
      </button>
    </form>
  );
}
