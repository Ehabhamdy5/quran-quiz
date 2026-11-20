'use client';

import { useRef, useState, useTransition } from 'react';
import { createMember, type TeamState } from './actions';
import { ROLE_LABELS } from '@/lib/team';

const inputCls = 'w-full rounded border p-2';

export function MemberForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<TeamState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const next = await createMember(null, fd);
      setState(next);
      if (next && next.errors.length === 0) ref.current?.reset();
    });
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3 rounded border bg-white p-4">
      <h2 className="font-bold">إضافة عضو</h2>
      {state?.errors.length ? (
        <ul className="list-disc rounded border border-red-300 bg-red-50 p-3 ps-8 text-sm text-red-800">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {state?.message ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="displayName" required placeholder="الاسم" className={inputCls} />
        <input name="email" type="email" required placeholder="البريد الإلكتروني" dir="ltr" className={inputCls} />
        <input name="password" type="password" required minLength={10} placeholder="كلمة مرور مؤقتة (10 أحرف فأكثر)" dir="ltr" className={inputCls} />
        <select name="role" defaultValue="writer" aria-label="الدور" className={inputCls}>
          {Object.entries(ROLE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
      </button>
    </form>
  );
}
