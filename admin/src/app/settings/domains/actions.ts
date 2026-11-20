'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeDomain } from '@/lib/domains';
import type { FormState } from '@/app/questions/actions';

export async function addDomain(_prev: FormState, fd: FormData): Promise<FormState> {
  const domain = normalizeDomain(String(fd.get('domain') ?? ''));
  if (!domain) return { errors: ['اكتب اسم موقع صالحًا مثل tafsir.net'] };

  const supabase = await createClient();
  const { error } = await supabase.from('allowed_media_domains').insert({ domain });
  if (error) return { errors: [error.code === '23505' ? 'هذا الموقع مضاف من قبل' : error.message] };

  revalidatePath('/settings/domains');
  return null;
}

export async function removeDomain(domain: string) {
  const supabase = await createClient();
  await supabase.from('allowed_media_domains').delete().eq('domain', domain);
  revalidatePath('/settings/domains');
}
