import { describe, it, expect } from 'vitest';
import {
  parseGenerateForm,
  buildPrompt,
  reviewProposal,
  generateDrafts,
  type AyahContext,
  type GenerateRequest,
} from './generation';
import type { ProposedQuestion } from './generation-schema';

const MUKHTASAR = 'المختصر في تفسير القرآن الكريم (عربي)';
const SAADI = 'تيسير الكريم الرحمن، عبد الرحمن بن ناصر السعدي (ت. 1376هـ)';

const contexts: AyahContext[] = [
  {
    surah: 112,
    ayah: 2,
    text: 'الله الصمد',
    tafsirs: [
      { source: 'mukhtasar_ar', attribution: MUKHTASAR, text: 'هو السيّد الذي انتهى إليه السُّؤْدَد في صفات الكمال والجمال، الذي تصمد إليه الخلائق.' },
      { source: 'saadi', attribution: SAADI, text: '{اللهُ الصمدُ}؛ أي: المقصود في جميع الحوائج؛ فأهل العالم العلويِّ والسفليِّ مفتقرون إليه غاية الافتقار' },
    ],
  },
  {
    surah: 112,
    ayah: 3,
    text: 'لم يلد ولم يولد',
    tafsirs: [{ source: 'mukhtasar_ar', attribution: MUKHTASAR, text: 'الذي لم يلد أحدًا، ولم يلده أحد، فلا ولد له - سبحانه - ولا والد.' }],
  },
];

const request: GenerateRequest = { surah: 112, fromAyah: 2, toAyah: 3, categoryId: 2, difficulty: 'beginner', count: 3 };

const mcq: ProposedQuestion = {
  type: 'mcq',
  prompt: 'ما معنى ﴿الصمد﴾ في قوله تعالى: ﴿الله الصمد﴾؟',
  options: ['المقصود في جميع الحوائج', 'الذي لا ينام', 'الخالق', 'الرزاق'],
  correct_option: 0,
  correct_bool: null,
  benefit: 'الصمد هو الذي يقصده الخلق كلهم في حوائجهم.',
  source: 'saadi',
  surah: 112,
  ayah: 2,
  evidence: 'المقصود في جميع الحوائج',
};

const tf: ProposedQuestion = {
  type: 'true_false',
  prompt: 'نفت الآية أن يكون لله ولد أو والد.',
  options: [],
  correct_option: null,
  correct_bool: true,
  benefit: 'لا ولد له سبحانه ولا والد.',
  source: 'mukhtasar_ar',
  surah: 112,
  ayah: 3,
  evidence: 'فلا ولد له سبحانه ولا والد',
};

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('parseGenerateForm', () => {
  it('accepts a valid range and caps it at five ayat', () => {
    const ok = parseGenerateForm(form({ surah: '112', fromAyah: '1', toAyah: '4', categoryId: '1', difficulty: 'beginner', count: '3' }));
    expect(ok.success).toBe(true);
    const tooLong = parseGenerateForm(form({ surah: '2', fromAyah: '1', toAyah: '6', categoryId: '1', difficulty: 'beginner', count: '3' }));
    expect(tooLong.success ? [] : tooLong.error.issues.map((i) => i.message)).toContain('اختر من آية إلى خمس آيات');
  });
});

describe('buildPrompt', () => {
  it('carries the request and every ayah with its tafsir', () => {
    const { system, user } = buildPrompt(request, contexts);
    expect(system).toContain('evidence');
    expect(user).toContain('3 أسئلة');
    expect(user).toContain('معاني الكلمات');
    expect(user).toContain('<ayah surah="112" number="3">');
    expect(user).toContain('<tafsir source="saadi"');
    expect(user).toContain('فلا ولد له');
  });
});

describe('reviewProposal', () => {
  it('turns valid proposals into ai draft rows with their reference', () => {
    const { accepted, rejected } = reviewProposal({ questions: [mcq, tf] }, contexts, request);
    expect(rejected).toEqual([]);
    expect(accepted[0]).toMatchObject({
      type: 'mcq',
      category_id: 2,
      difficulty: 'beginner',
      options: mcq.options,
      correct_answer: 0,
      source_book: SAADI,
      source_volume: null,
      source_page: 'تفسير الآية 112:2',
      surah: 112,
      ayah: 2,
      origin: 'ai',
      source_excerpt: 'المقصود في جميع الحوائج',
    });
    expect(accepted[1]).toMatchObject({ type: 'true_false', options: null, correct_answer: true, source_book: MUKHTASAR });
  });

  it.each<[string, Partial<ProposedQuestion>, string]>([
    ['a paraphrased quote', { evidence: 'المقصود في كل الحاجات' }, 'الاقتباس غير موجود حرفيًا في التفسير المنسوب إليه'],
    ['a quote from the wrong book', { source: 'mukhtasar_ar' }, 'الاقتباس غير موجود حرفيًا في التفسير المنسوب إليه'],
    ['an ayah outside the range', { ayah: 4 }, 'السؤال خارج الآيات المطلوبة'],
    ['quranic text in an option', { options: ['﴿الصمد﴾', 'ب', 'ج', 'د'] }, 'لا يُكتب نص قرآني في الخيارات'],
    ['a misquoted ayah', { prompt: 'ما معنى قوله تعالى: ﴿الله الواحد﴾؟' }, 'النص القرآني في السؤال لا يطابق نص الآية'],
    ['three options', { options: ['أ', 'ب', 'ج'] }, 'الاختيار من متعدد يحتاج أربعة خيارات مختلفة غير فارغة'],
    ['repeated options', { options: ['أ', 'أ', 'ج', 'د'] }, 'الاختيار من متعدد يحتاج أربعة خيارات مختلفة غير فارغة'],
    ['no correct option', { correct_option: null }, 'حدّد الخيار الصحيح'],
  ])('rejects %s', (_, change, reason) => {
    const { accepted, rejected } = reviewProposal({ questions: [{ ...mcq, ...change }] }, contexts, request);
    expect(accepted).toEqual([]);
    expect(rejected[0].reason).toBe(reason);
  });

  it('rejects a true/false question without an answer, and keeps no more than requested', () => {
    expect(reviewProposal({ questions: [{ ...tf, correct_bool: null }] }, contexts, request).rejected[0].reason).toBe(
      'حدّد إجابة صواب أو خطأ',
    );
    const many = reviewProposal({ questions: [mcq, tf, mcq, tf] }, contexts, request);
    expect(many.accepted).toHaveLength(3);
  });
});

describe('generateDrafts', () => {
  it('fetches every ayah, asks once, and reviews the answer', async () => {
    const fetched: number[] = [];
    let asked = '';
    const result = await generateDrafts(request, {
      source: {
        async getAyah(surah, ayah) {
          fetched.push(ayah);
          return contexts.find((c) => c.ayah === ayah)!;
        },
      },
      propose: async (prompt) => {
        asked = prompt.user;
        return { questions: [mcq, { ...tf, evidence: 'كلام غير موجود في التفسير' }] };
      },
    });
    expect(fetched).toEqual([2, 3]);
    expect(asked).toContain('الله الصمد');
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
  });
});
