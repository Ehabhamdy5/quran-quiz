import { createClient } from '@/lib/supabase/server';
import { DIFFICULTY_LABELS, type Difficulty } from '@/lib/question-schema';
import { resolveReport } from '@/app/questions/actions';

type Stats = { answers: number; correct: number; correct_rate: number | null; open_reports: number; suggested_level: Difficulty | null };
type Report = { id: string; reason: string; created_at: string };

// إحصاءات اللاعبين وبلاغاتهم على السؤال، واقتراح إعادة تصنيفه إن ابتعدت نسبة الإجابة عن مستواه.
export async function QuestionInsights({ id, canResolve }: { id: string; canResolve: boolean }) {
  const supabase = await createClient();
  const [{ data: stats }, { data: reports }] = await Promise.all([
    supabase.rpc('question_stats', { p_question: id }).maybeSingle<Stats>(),
    supabase
      .from('question_reports')
      .select('id, reason, created_at')
      .eq('question_id', id)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .returns<Report[]>(),
  ]);
  if (!stats || (stats.answers === 0 && (reports ?? []).length === 0)) return null;

  return (
    <section className="space-y-2 rounded border bg-white p-4 text-sm">
      <h2 className="font-medium">من اللعب</h2>
      <p>
        أجاب {stats.answers} لاعبًا، أصاب منهم {stats.correct}
        {stats.correct_rate !== null && ` (${Math.round(stats.correct_rate * 100)}%)`}.
      </p>
      {stats.suggested_level && (
        <p className="text-amber-800">
          نسبة الإجابة الصحيحة بعيدة عن مستوى السؤال: يُقترح إعادة تصنيفه «{DIFFICULTY_LABELS[stats.suggested_level]}».
        </p>
      )}
      {(reports ?? []).length > 0 && (
        <div className="space-y-1">
          <h3 className="font-medium text-amber-900">بلاغات مفتوحة ({reports!.length})</h3>
          <ul className="space-y-1">
            {reports!.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 p-2">
                <span>{r.reason}</span>
                {canResolve && (
                  <form action={resolveReport.bind(null, id, r.id)}>
                    <button className="shrink-0 text-amber-900 hover:underline">تمت المعالجة</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
