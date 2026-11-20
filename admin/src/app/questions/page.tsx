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
};

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('questions')
    .select('id, prompt, status, difficulty, origin, categories(name_ar)')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (status && isQuestionStatus(status)) query = query.eq('status', status);

  const { data, error } = await query.returns<ListRow[]>();
  if (error) return <p className="text-red-700">{error.message}</p>;
  if (!data || data.length === 0) return <p className="text-gray-600">لا توجد أسئلة في هذه القائمة.</p>;

  return (
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
            </td>
            <td className="p-2">{q.categories?.name_ar}</td>
            <td className="p-2">{DIFFICULTY_LABELS[q.difficulty]}</td>
            <td className="p-2">{STATUS_LABELS[q.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
