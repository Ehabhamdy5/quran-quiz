import { createClient } from '@supabase/supabase-js';

// للخادم فقط: يتجاوز الصلاحيات، فلا يُستعمل إلا بعد التحقق من أن المستدعي مدير.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY غير مضبوط');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
