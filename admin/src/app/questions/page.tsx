import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABELS, isQuestionStatus, type QuestionStatus } from '@/lib/status';
import { DIFFICULTY_LABELS, type Difficulty } from '@/lib/question-schema';

type ListRow = {
  id: string;
  prompt: string;
  status: QuestionStatus;
  difficulty: Difficulty;
  origin: 'human' | 'ai';
  categories: { name_ar: string } | null;
  question_media: { broken_at: string | null }[];
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; broken?: string; reported?: string }>;
}) {
  const { status, broken, reported } = await searchParams;
  const onlyBroken = broken === '1';
  const onlyReported = reported === '1';
  const supabase = await createClient();

  let query = supabase
    .from('questions')
    .select(
      `id, prompt, status, difficulty, origin, categories(name_ar), ${onlyBroken ? 'question_media!inner(broken_at)' : 'question_media(broken_at)'}${onlyReported ? ', question_reports!inner(resolved_at)' : ''}`,
    )
    .order('updated_at', { ascending: false })
    .limit(200);
  if (status && isQuestionStatus(status)) query = query.eq('status', status);
  if (onlyBroken) query = query.not('question_media.broken_at', 'is', null);
  if (onlyReported) query = query.is('question_reports.resolved_at', null);

  const { data, error } = await query.returns<ListRow[]>();
  if (error) return <p className="text-red-700">{error.message}</p>;

  return (
    <div className="space-y-3">
      {onlyReported && (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          أسئلة عليها بلاغات من اللاعبين لم تُعالج بعد. يُوقف السؤال المنشور آليًا عند ثلاثة بلاغات.
        </p>
      )}
      {onlyBroken && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          أسئلة فيها رابط وسيط معطل. ما كان منها منشورًا أُوقف آليًا: أصلح الرابط ثم أرسل السؤال للمراجعة.
        </p>
      )}
      {!data || data.length === 0 ? (
        <p className="text-gray-600">لا توجد أسئلة في هذه القائمة.</p>
      ) : (
        <table className="w-full border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-start">السؤال</th>
              <th className="p-2 text-start">التصنيف</th>
              <th className="p-2 text-start">المستوى</th>
              <th className="p-2 text-start">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {data.map((q) => (
              <tr key={q.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <Link href={`/questions/${q.id}`} className="text-blue-800 hover:underline">
                    {q.prompt}
                  </Link>
                  {q.origin === 'ai' && <span className="ms-2 rounded bg-amber-100 px-1.5 text-xs text-amber-900">آلي</span>}
                  {q.question_media.some((m) => m.broken_at) && (
                    <span className="ms-2 rounded bg-red-100 px-1.5 text-xs text-red-900">رابط معطل</span>
                  )}
                </td>
                <td className="p-2">{q.categories?.name_ar}</td>
                <td className="p-2">{DIFFICULTY_LABELS[q.difficulty]}</td>
                <td className="p-2">{STATUS_LABELS[q.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
