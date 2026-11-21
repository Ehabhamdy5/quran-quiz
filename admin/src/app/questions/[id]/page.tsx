import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QuestionForm, type MediaDefaults } from '@/components/QuestionForm';
import { MediaPreview } from '@/components/MediaPreview';
import { TransitionPanel } from '@/components/TransitionPanel';
import { QuestionInsights } from '@/components/QuestionInsights';
import { STATUS_LABELS, availableTransitions, canEdit, type QuestionStatus, type Role } from '@/lib/status';
import { TYPE_LABELS, DIFFICULTY_LABELS, type QuestionRow } from '@/lib/question-schema';
import type { Placement } from '@/lib/media';
import { saveQuestion } from '../actions';

type MediaRow = MediaDefaults & { placement: Placement; broken_at: string | null; check_error: string | null };

function QuestionSummary({ q }: { q: QuestionRow }) {
  return (
    <dl className="grid gap-2 rounded border bg-white p-4 sm:grid-cols-[10rem_1fr]">
      <dt className="font-medium">النوع والمستوى</dt>
      <dd>
        {TYPE_LABELS[q.type]} · {DIFFICULTY_LABELS[q.difficulty]}
      </dd>
      {q.options && (
        <>
          <dt className="font-medium">{q.type === 'ordering' ? 'الترتيب الصحيح' : 'الخيارات'}</dt>
          <dd>
            <ol className="list-decimal ps-5">
              {q.options.map((o, i) => (
                <li key={i} className={q.correct_answer === i ? 'font-bold text-emerald-800' : ''}>
                  {o}
                </li>
              ))}
            </ol>
          </dd>
        </>
      )}
      {q.type === 'true_false' && (
        <>
          <dt className="font-medium">الإجابة</dt>
          <dd>{q.correct_answer ? 'صواب' : 'خطأ'}</dd>
        </>
      )}
      <dt className="font-medium">الفائدة</dt>
      <dd>{q.benefit}</dd>
      <dt className="font-medium">المصدر</dt>
      <dd>{[q.source_book, q.source_volume, q.source_page].filter(Boolean).join(' / ')}</dd>
      {q.surah !== null && (
        <>
          <dt className="font-medium">الآية</dt>
          <dd>
            {q.surah}:{q.ayah}
          </dd>
        </>
      )}
    </dl>
  );
}

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: q }, { data: media }, { data: categories }, { data: profile }] = await Promise.all([
    supabase.from('questions').select('*').eq('id', id).maybeSingle<QuestionRow>(),
    supabase.from('question_media').select('placement, kind, url, start_seconds, end_seconds, alt_text, broken_at, check_error').eq('question_id', id).returns<MediaRow[]>(),
    supabase.from('categories').select('id, name_ar').order('id'),
    supabase.from('profiles').select('role').eq('id', user.id).single<{ role: Role }>(),
  ]);
  if (!q) notFound();

  const role: Role = profile?.role ?? 'writer';
  const status = q.status as QuestionStatus;
  const isAuthor = q.author_id === user.id;
  const pick = (p: Placement): MediaRow | null => (media ?? []).find((m) => m.placement === p) ?? null;
  const placements: Placement[] = ['question', 'answer'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{q.prompt}</h1>
        <span className="rounded bg-gray-200 px-2 py-0.5 text-sm">{STATUS_LABELS[status]}</span>
        {q.origin === 'ai' && <span className="rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-900">مولَّد آليًا</span>}
      </div>

      {q.review_notes && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3">ملاحظات المراجع: {q.review_notes}</p>
      )}

      {q.source_excerpt && (
        <figure className="rounded border border-emerald-200 bg-emerald-50 p-3">
          <figcaption className="mb-1 text-sm font-medium text-emerald-900">
            الاقتباس الذي بُني عليه السؤال: {q.source_book}، {q.source_page}
          </figcaption>
          <blockquote className="text-gray-900">«{q.source_excerpt}»</blockquote>
        </figure>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {placements.map((p) => {
          const m = pick(p);
          return m ? (
            <div key={p} className="space-y-1">
              <h2 className="text-sm font-medium">{p === 'question' ? 'وسيط السؤال' : 'شرح الإجابة'}</h2>
              <MediaPreview kind={m.kind} url={m.url} start={m.start_seconds} end={m.end_seconds} alt={m.alt_text} />
              {m.broken_at && (
                <p className="text-sm text-red-700">
                  الرابط معطل منذ {new Date(m.broken_at).toLocaleDateString('ar')}: {m.check_error}
                </p>
              )}
            </div>
          ) : null;
        })}
      </section>

      <QuestionInsights id={id} canResolve={role === 'reviewer' || role === 'admin'} />

      <TransitionPanel id={id} targets={availableTransitions(status, role, isAuthor)} generated={q.origin === 'ai'} />

      {canEdit(status, role, isAuthor) ? (
        <QuestionForm
          categories={categories ?? []}
          action={saveQuestion.bind(null, id)}
          defaults={{ ...q, media: { question: pick('question'), answer: pick('answer') } }}
        />
      ) : (
        <QuestionSummary q={q} />
      )}
    </div>
  );
}
