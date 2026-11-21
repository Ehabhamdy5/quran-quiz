'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') ?? ''),
    password: String(fd.get('password') ?? ''),
  });
  if (error) return 'البريد أو كلمة المرور غير صحيحة';
  // حسابات اللاعبين تسجّل الدخول في التطبيق، لا في لوحة الفريق.
  const { data: role } = await supabase.rpc('my_role');
  if (!role) {
    await supabase.auth.signOut();
    return 'هذا الحساب ليس من فريق المحتوى';
  }
  redirect('/questions');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
