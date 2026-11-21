import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/AppHeader';

export default async function QuestionsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('my_role');
  if (!role) redirect('/login');

  return (
    <div className="mx-auto max-w-5xl p-6">
      <AppHeader />
      {children}
    </div>
  );
}
