import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/AppHeader';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('my_role');
  if (role !== 'admin') notFound();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <AppHeader />
      {children}
    </div>
  );
}
