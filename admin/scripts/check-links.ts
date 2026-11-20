import { createClient } from '@supabase/supabase-js';
import { runLinkCheck } from '../src/lib/link-check';

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('اضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: media, error } = await db.from('question_media').select('id, url');
  if (error) throw new Error(error.message);

  const summary = await runLinkCheck(media ?? [], async (id, ok, err) => {
    const { data, error: rpcError } = await db.rpc('record_link_check', { m_id: id, ok, err });
    if (rpcError) throw new Error(rpcError.message);
    return data === true;
  });

  console.log(JSON.stringify(summary));
  if (summary.failures.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
