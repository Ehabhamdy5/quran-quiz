'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRole, parseNewMember } from '@/lib/team';

export type TeamState = { errors: string[]; message?: string } | null;

export async function setRole(id: string, _prev: TeamState, fd: FormData): Promise<TeamState> {
  const role = String(fd.get('role') ?? '');
  if (!isRole(role)) return { errors: ['دور غير معروف'] };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_user_role', { target: id, new_role: role });
  if (error) return { errors: [error.message] };

  revalidatePath('/settings/team');
  return { errors: [], message: 'حُفظ' };
}

export async function createMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const parsed = parseNewMember(fd);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => i.message) };

  const supabase = await createClient();
  const { data: myRole } = await supabase.rpc('my_role');
  if (myRole !== 'admin') return { errors: ['إدارة الفريق للمدير فقط'] };

  const { email, displayName, password, role } = parsed.data;
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) return { errors: [error.code === 'email_exists' ? 'هذا البريد مسجَّل من قبل' : error.message] };

  if (role !== 'writer') {
    const { error: roleError } = await supabase.rpc('set_user_role', { target: data.user.id, new_role: role });
    if (roleError) return { errors: [roleError.message] };
  }

  revalidatePath('/settings/team');
  return { errors: [], message: `أُنشئ حساب ${email}` };
}
