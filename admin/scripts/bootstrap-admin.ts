// ينشئ أول حساب مدير في مشروع جديد (أو يرقّي حسابًا موجودًا إلى مدير).
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run bootstrap-admin
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'المدير';
  if (!url || !key || !email) {
    console.error('اضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY و ADMIN_EMAIL (و ADMIN_PASSWORD لحساب جديد)');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(listError.message);
  let user = list.users.find((u) => u.email?.toLowerCase() === email);

  if (user) {
    const { error } = await db.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, staff: true } });
    if (error) throw new Error(error.message);
    console.log(`الحساب موجود: ${email}`);
  } else {
    if (!password || password.length < 10) {
      console.error('ADMIN_PASSWORD مطلوبة لحساب جديد (10 أحرف على الأقل)');
      process.exit(1);
    }
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
      app_metadata: { staff: true },
    });
    if (error) throw new Error(error.message);
    user = data.user;
    console.log(`أُنشئ الحساب: ${email}`);
  }

  // مفتاح الخدمة يتجاوز الصلاحيات، فيُرقّى مباشرة (لا يوجد مدير بعد يستدعي set_user_role).
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id)
    .select('display_name, role')
    .single();
  if (profileError) throw new Error(`لم يُعثر على ملف الفريق: ${profileError.message}`);
  console.log(`الدور: ${profile.role} (${profile.display_name})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
