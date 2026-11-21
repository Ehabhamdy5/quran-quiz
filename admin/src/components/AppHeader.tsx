import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABELS } from '@/lib/status';
import { signOut } from '@/app/login/actions';

const linkCls = 'text-sm text-blue-800 hover:underline';

export async function AppHeader() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('my_role');

  return (
    <header className="mb-6 flex flex-wrap items-center gap-3 border-b pb-4">
      <Link href="/questions" className="font-bold">
        بنك الأسئلة
      </Link>
      {Object.entries(STATUS_LABELS).map(([key, label]) => (
        <Link key={key} href={`/questions?status=${key}`} className={linkCls}>
          {label}
        </Link>
      ))}
      <Link href="/questions?broken=1" className="text-sm text-red-800 hover:underline">
        تحتاج إصلاحًا
      </Link>
      <Link href="/questions?reported=1" className="text-sm text-amber-800 hover:underline">
        عليها بلاغات
      </Link>
      {role === 'admin' && (
        <>
          <span className="text-gray-300">|</span>
          <Link href="/settings/team" className={linkCls}>
            الفريق
          </Link>
          <Link href="/settings/domains" className={linkCls}>
            المواقع المسموح بها
          </Link>
        </>
      )}
      <Link href="/questions/generate" className="ms-auto text-sm text-emerald-800 hover:underline">
        توليد مساعَد
      </Link>
      <Link href="/questions/new" className="rounded bg-emerald-700 px-3 py-1.5 text-white">
        سؤال جديد
      </Link>
      <form action={signOut}>
        <button className="text-sm text-gray-600 hover:underline">خروج</button>
      </form>
    </header>
  );
}
