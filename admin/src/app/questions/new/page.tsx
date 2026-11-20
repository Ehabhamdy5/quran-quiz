import { createClient } from '@/lib/supabase/server';
import { QuestionForm } from '@/components/QuestionForm';
import { saveQuestion } from '../actions';

export default async function NewQuestionPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from('categories').select('id, name_ar').order('id');
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">سؤال جديد</h1>
      <QuestionForm categories={categories ?? []} action={saveQuestion.bind(null, null)} />
    </>
  );
}
