'use client';

import { useActionState } from 'react';
import { addDomain } from './actions';

export function DomainForm() {
  const [state, action, pending] = useActionState(addDomain, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="domain" required dir="ltr" placeholder="tafsir.net" className="flex-1 rounded border p-2" />
        <button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
          إضافة
        </button>
      </div>
      {state?.errors.length ? <p className="text-sm text-red-700">{state.errors.join('، ')}</p> : null}
    </form>
  );
}
