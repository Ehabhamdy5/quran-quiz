// يستورد ملفات مسودات (content/drafts/*.json) بعد فحصها آليًا على نص التفسير الحقيقي.
//   npm run import-drafts -- ../content/drafts/*.json          فحص وحفظ
//   npm run import-drafts -- --dry-run ../content/drafts/*.json  فحص فقط
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseDraftFile } from '../src/lib/draft-file';
import { generateDrafts, GenerationError } from '../src/lib/generation';
import { connectTafsirMcp } from '../src/lib/tafsir-mcp';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const files = args.filter((a) => a !== '--dry-run');
  const tafsirUrl = process.env.TAFSIR_MCP_URL;
  if (files.length === 0 || !tafsirUrl) {
    console.error('الاستعمال: اضبط TAFSIR_MCP_URL ثم مرّر ملفًا واحدًا أو أكثر');
    process.exit(1);
  }

  let db: SupabaseClient | null = null;
  let authorId = '';
  if (!dryRun) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const email = process.env.DRAFT_AUTHOR_EMAIL?.toLowerCase();
    if (!url || !key || !email) {
      console.error('للحفظ اضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY و DRAFT_AUTHOR_EMAIL (كاتب تُنسب إليه المسودات)');
      process.exit(1);
    }
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: users, error } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    authorId = users.users.find((u) => u.email?.toLowerCase() === email)?.id ?? '';
    if (!authorId) throw new Error(`لا يوجد حساب بالبريد ${email}`);
  }

  const tafsir = await connectTafsirMcp(tafsirUrl, process.env.TAFSIR_MCP_TOKEN);
  let failed = false;
  try {
    for (const file of files) {
      console.log(`\n# ${file}`);
      try {
        const { request, proposal } = parseDraftFile(JSON.parse(readFileSync(file, 'utf8')));
        const { accepted, rejected } = await generateDrafts(request, { source: tafsir.source, propose: async () => proposal });
        for (const r of rejected) console.log(`  مرفوض: ${r.prompt} (${r.reason})`);
        if (rejected.length > 0) failed = true;

        for (const row of accepted) {
          if (!db) {
            console.log(`  سليم: ${row.prompt}`);
            continue;
          }
          const { data: existing } = await db
            .from('questions')
            .select('id')
            .eq('prompt', row.prompt)
            .eq('surah', row.surah)
            .eq('ayah', row.ayah)
            .limit(1);
          if (existing && existing.length > 0) {
            console.log(`  موجود من قبل: ${row.prompt}`);
            continue;
          }
          const { error } = await db.from('questions').insert({ ...row, author_id: authorId });
          if (error) throw new Error(error.message);
          console.log(`  حُفظ: ${row.prompt}`);
        }
      } catch (e) {
        failed = true;
        console.log(`  خطأ: ${e instanceof GenerationError || e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    await tafsir.close().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
