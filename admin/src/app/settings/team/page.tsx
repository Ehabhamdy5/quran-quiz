import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ROLE_LABELS } from '@/lib/team';
import type { Role } from '@/lib/status';
import { RoleForm } from './RoleForm';
import { MemberForm } from './MemberForm';

type Profile = { id: string; display_name: string; role: Role };

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profiles }, { data: users }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role').order('display_name').returns<Profile[]>(),
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? '']));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">الفريق</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-start">الاسم</th>
            <th className="p-2 text-start">البريد</th>
            <th className="p-2 text-start">الدور</th>
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((p) => (
            <tr key={p.id} className="border-b">
              <td className="p-2">{p.display_name}</td>
              <td className="p-2" dir="ltr">
                {emails.get(p.id)}
              </td>
              <td className="p-2">
                {p.id === user?.id ? `${ROLE_LABELS[p.role]} (أنت)` : <RoleForm id={p.id} role={p.role} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <MemberForm />
    </div>
  );
}
