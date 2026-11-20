import Link from 'next/link';
import { STATUS_LABELS } from '@/lib/status';
import { signOut } from '@/app/login/actions';

export default function QuestionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b pb-4">
        <Link href="/questions" className="font-bold">
          بنك الأسئلة
        </Link>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <Link key={key} href={`/questions?status=${key}`} className="text-sm text-blue-800 hover:underline">
            {label}
          </Link>
        ))}
        <Link href="/questions/new" className="ms-auto rounded bg-emerald-700 px-3 py-1.5 text-white">
          سؤال جديد
        </Link>
        <form action={signOut}>
          <button className="text-sm text-gray-600 hover:underline">خروج</button>
        </form>
      </header>
      {children}
    </div>
  );
}
