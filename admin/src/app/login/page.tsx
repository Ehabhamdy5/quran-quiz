'use client';

import { useActionState } from 'react';
import { login } from './actions';

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto mt-24 max-w-sm space-y-4 rounded border bg-white p-6">
      <h1 className="text-xl font-bold">دخول فريق المحتوى</h1>
      <form action={action} className="space-y-3">
        <input name="email" type="email" required placeholder="البريد الإلكتروني" dir="ltr" className="w-full rounded border p-2" />
        <input name="password" type="password" required placeholder="كلمة المرور" dir="ltr" className="w-full rounded border p-2" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="w-full rounded bg-emerald-700 p-2 text-white disabled:opacity-50">
          دخول
        </button>
      </form>
    </main>
  );
}
