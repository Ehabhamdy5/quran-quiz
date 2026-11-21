import { z } from 'zod';

export const TYPE_LABELS = {
  mcq: 'اختيار من متعدد',
  true_false: 'صواب أو خطأ',
  visual: 'سؤال مرئي',
  ordering: 'ترتيب',
} as const;

export const DIFFICULTY_LABELS = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
} as const;

export type QuestionType = keyof typeof TYPE_LABELS;
export type Difficulty = keyof typeof DIFFICULTY_LABELS;

export type QuestionRow = {
  id: string;
  prompt: string;
  type: QuestionType;
  category_id: number;
  difficulty: Difficulty;
  options: string[] | null;
  correct_answer: number | boolean | null;
  benefit: string;
  source_book: string;
  source_volume: string | null;
  source_page: string;
  surah: number | null;
  ayah: number | null;
  origin: 'human' | 'ai';
  status: string;
  author_id: string;
  review_notes: string | null;
  source_excerpt: string | null;
};

export const questionSchema = z
  .object({
    prompt: z.string().trim().min(1, 'نص السؤال مطلوب'),
    type: z.enum(['mcq', 'true_false', 'visual', 'ordering'], { errorMap: () => ({ message: 'اختر نوع السؤال' }) }),
    categoryId: z.number({ invalid_type_error: 'اختر التصنيف' }).int().min(1).max(4),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced'], { errorMap: () => ({ message: 'اختر المستوى' }) }),
    benefit: z.string().trim().min(1, 'الفائدة مطلوبة'),
    sourceBook: z.string().trim().min(1, 'اسم المصدر مطلوب'),
    sourceVolume: z.string().trim().nullable(),
    sourcePage: z.string().trim().min(1, 'رقم الصفحة مطلوب'),
    surah: z.number().int().min(1, 'رقم السورة بين 1 و114').max(114, 'رقم السورة بين 1 و114').nullable(),
    ayah: z.number().int().min(1, 'رقم الآية يبدأ من 1').nullable(),
    options: z.array(z.string().trim()),
    correct: z.union([z.number().int(), z.boolean(), z.null()]),
  })
  .superRefine((q, ctx) => {
    if ((q.surah === null) !== (q.ayah === null)) {
      ctx.addIssue({ code: 'custom', path: ['ayah'], message: 'أدخل السورة والآية معًا أو اتركهما معًا' });
    }
    if (q.type === 'mcq' || q.type === 'visual') {
      if (q.options.length !== 4 || q.options.some((o) => o === '')) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'أدخل أربعة خيارات غير فارغة' });
      }
      if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) {
        ctx.addIssue({ code: 'custom', path: ['correct'], message: 'اختر الإجابة الصحيحة' });
      }
    } else if (q.type === 'true_false') {
      if (typeof q.correct !== 'boolean') {
        ctx.addIssue({ code: 'custom', path: ['correct'], message: 'اختر صواب أو خطأ' });
      }
    } else if (q.options.length < 3 || q.options.length > 6) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'أدخل من 3 إلى 6 عناصر بترتيبها الصحيح' });
    }
  });

export type QuestionInput = z.infer<typeof questionSchema>;

const text = (v: FormDataEntryValue | null) => String(v ?? '');
const optionalNumber = (v: FormDataEntryValue | null) => {
  const s = text(v).trim();
  return s === '' ? null : Number(s);
};

export function parseQuestionForm(fd: FormData) {
  const type = text(fd.get('type'));
  const correctRaw = text(fd.get('correct'));
  const allOptions = fd.getAll('option').map((o) => String(o).trim());

  let options: string[];
  let correct: number | boolean | null;
  if (type === 'true_false') {
    options = [];
    correct = correctRaw === 'true' ? true : correctRaw === 'false' ? false : null;
  } else if (type === 'ordering') {
    options = allOptions.filter((o) => o !== '');
    correct = null;
  } else {
    options = allOptions;
    correct = correctRaw === '' ? null : Number(correctRaw);
  }

  return questionSchema.safeParse({
    prompt: text(fd.get('prompt')),
    type,
    categoryId: optionalNumber(fd.get('categoryId')),
    difficulty: text(fd.get('difficulty')),
    benefit: text(fd.get('benefit')),
    sourceBook: text(fd.get('sourceBook')),
    sourceVolume: text(fd.get('sourceVolume')).trim() || null,
    sourcePage: text(fd.get('sourcePage')),
    surah: optionalNumber(fd.get('surah')),
    ayah: optionalNumber(fd.get('ayah')),
    options,
    correct,
  });
}

export function toRow(q: QuestionInput) {
  return {
    prompt: q.prompt,
    type: q.type,
    category_id: q.categoryId,
    difficulty: q.difficulty,
    benefit: q.benefit,
    source_book: q.sourceBook,
    source_volume: q.sourceVolume,
    source_page: q.sourcePage,
    surah: q.surah,
    ayah: q.ayah,
    options: q.type === 'true_false' ? null : q.options,
    correct_answer: q.type === 'ordering' ? null : q.correct,
  };
}
