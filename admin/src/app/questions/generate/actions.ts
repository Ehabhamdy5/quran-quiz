'use server';

import Anthropic from '@anthropic-ai/sdk';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { GenerationError, generateDrafts, parseGenerateForm, type Rejection } from '@/lib/generation';
import { connectTafsirMcp } from '@/lib/tafsir-mcp';
import { proposeWithClaude } from '@/lib/claude';

export type GenerateState = {
  errors: string[];
  created?: { id: string; prompt: string }[];
  rejected?: Rejection[];
} | null;

export async function generateQuestions(_prev: GenerateState, fd: FormData): Promise<GenerateState> {
  const parsed = parseGenerateForm(fd);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => i.message) };

  const supabase = await createClient();
  const { data: role } = await supabase.rpc('my_role');
  if (role !== 'writer' && role !== 'admin') return { errors: ['التوليد للكتّاب والمدير'] };

  const url = process.env.TAFSIR_MCP_URL;
  if (!url) return { errors: ['التوليد غير مهيأ: اضبط TAFSIR_MCP_URL'] };

  let tafsir: Awaited<ReturnType<typeof connectTafsirMcp>> | null = null;
  try {
    tafsir = await connectTafsirMcp(url, process.env.TAFSIR_MCP_TOKEN);
    const { accepted, rejected } = await generateDrafts(parsed.data, { source: tafsir.source, propose: proposeWithClaude });

    let created: { id: string; prompt: string }[] = [];
    if (accepted.length > 0) {
      const { data, error } = await supabase.from('questions').insert(accepted).select('id, prompt');
      if (error) return { errors: [error.message], rejected };
      created = data ?? [];
    }
    revalidatePath('/questions');
    return { errors: [], created, rejected };
  } catch (e) {
    if (e instanceof GenerationError) return { errors: [e.message] };
    if (e instanceof Anthropic.APIError) return { errors: [`تعذّر الاتصال بخدمة Claude (${e.status ?? 'شبكة'})`] };
    return { errors: [`تعذّر التوليد: ${e instanceof Error ? e.message : String(e)}`] };
  } finally {
    await tafsir?.close().catch(() => {});
  }
}
