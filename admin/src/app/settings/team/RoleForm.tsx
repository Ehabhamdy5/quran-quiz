'use client';

import { useActionState } from 'react';
import { setRole } from './actions';
import { ROLE_LABELS } from '@/lib/team';
import type { Role } from '@/lib/status';

export function RoleForm({ id, role }: { id: string; role: Role }) {
  const [state, action, pending] = useActionState(setRole.bind(null, id), null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <select name="role" defaultValue={role} aria-label="الدور" className="rounded border p-1">
        {Object.entries(ROLE_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <button disabled={pending} className="rounded border border-gray-400 px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50">
        حفظ
      </button>
      {state?.errors.length ? <span className="text-sm text-red-700">{state.errors.join('، ')}</span> : null}
      {state?.message ? <span className="text-sm text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
