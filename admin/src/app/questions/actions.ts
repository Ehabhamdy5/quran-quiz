'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseQuestionForm, toRow } from '@/lib/question-schema';
import { readMediaFields, validateMedia, type Placement } from '@/lib/media';
import { isQuestionStatus } from '@/lib/status';

export type FormState = { errors: string[] } | null;

const PLACEMENTS: Placement[] = ['question', 'answer'];

export async function saveQuestion(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const parsed = parseQuestionForm(fd);
  const errors = parsed.success ? [] : parsed.error.issues.map((i) => i.message);

  const { data: domains } = await supabase.from('allowed_media_domains').select('domain');
  const allowed = (domains ?? []).map((d) => d.domain as string);
  const media = PLACEMENTS.map((placement) => ({ placement, input: readMediaFields(fd, placement) }));
  for (const m of media) if (m.input) errors.push(...validateMedia(m.input, allowed));

  if (!parsed.success || errors.length > 0) return { errors };

  let questionId = id;
  if (questionId) {
    const { data, error } = await supabase.from('questions').update(toRow(parsed.data)).eq('id', questionId).select('id');
    if (error) return { errors: [error.message] };
    if (!data || data.length === 0) return { errors: ['لا تملك صلاحية تعديل هذا السؤال في حالته الحالية'] };
  } else {
    const { data, error } = await supabase.from('questions').insert(toRow(parsed.data)).select('id').single();
    if (error) return { errors: [error.message] };
    questionId = data.id as string;
  }

  for (const { placement, input } of media) {
    const { error } = input
      ? await supabase.from('question_media').upsert(
          {
            question_id: questionId,
            placement,
            kind: input.kind,
            url: input.url,
            start_seconds: input.startSeconds,
            end_seconds: input.endSeconds,
            alt_text: input.altText,
          },
          { onConflict: 'question_id,placement' },
        )
      : await supabase.from('question_media').delete().eq('question_id', questionId).eq('placement', placement);
    if (error) return { errors: [error.message] };
  }

  revalidatePath('/questions');
  redirect(`/questions/${questionId}`);
}

export async function transitionQuestion(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const target = String(fd.get('target') ?? '');
  if (!isQuestionStatus(target)) return { errors: ['حالة غير معروفة'] };

  const supabase = await createClient();
  const notes = String(fd.get('notes') ?? '').trim();
  const { error } = await supabase.rpc('transition_question', { q_id: id, target, notes: notes || null });
  if (error) return { errors: [error.message] };

  revalidatePath('/questions');
  revalidatePath(`/questions/${id}`);
  return null;
}

export async function resolveReport(questionId: string, reportId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from('question_reports')
    .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id })
    .eq('id', reportId);
  revalidatePath(`/questions/${questionId}`);
}
