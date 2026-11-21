# خطة تنفيذ: التوليد المساعَد من المختصر والسعدي (الخطة 3 من 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**الهدف:** يختار الكاتب سورة ومقطعًا من آياتها (حتى 5 آيات)، فيجلب النظام نص الآيات وتفسيرها من «المختصر في تفسير القرآن الكريم» و«تيسير الكريم الرحمن» للسعدي عبر خادم Tafsir MCP، ثم يقترح Claude مسودات أسئلة، لكل منها اقتباس حرفي من التفسير يثبت إجابتها. تُحفظ المسودات بعلامة «مولَّد آليًا» وتمر بمسار المراجعة المعتاد.

**البنية:** ثلاث طبقات منفصلة لتُختبر كل واحدة دون شبكة:
1. **مصدر التفسير** (`tafsir-mcp.ts`): عميل MCP يستدعي الأداتين `fetch_ayah` و`fetch_tafsir`، ويجمع أجزاء النص الطويل.
2. **الاقتراح** (`claude.ts`): طلب واحد إلى Claude بمخرجات منظّمة (Zod).
3. **الفحص** (`generation.ts`): كل سؤال مقترح يُفحص آليًا قبل الحفظ. يُرفض إن لم يوجد اقتباسه حرفيًا في التفسير الذي نسبه إليه، أو خرج عن الآيات المطلوبة، أو وضع نصًا قرآنيًا في الخيارات، أو اقتبس من الآية ما ليس فيها.

والقاعدة تضيف عمود `source_excerpt` لا يقبله إلا سؤال مولَّد، ولا يتغير بعد الإنشاء.

**التقنيات:** ما في الخطتين السابقتين، ويُضاف `@anthropic-ai/sdk` (النموذج `claude-opus-5-5`، مع البديل الآلي عند الرفض) و`@modelcontextprotocol/sdk`.

**المرجع:** وثيقة التصميم، قسم «التوليد المساعَد» و«الضوابط القرآنية». والمسألة المفتوحة «ما كتب التفسير المعتمدة» حُسمت: المختصر والسعدي.

**الإعداد:** في `admin/.env.local`:

```
ANTHROPIC_API_KEY=<مفتاح Claude API>
TAFSIR_MCP_URL=<رابط خادم Tafsir MCP (Streamable HTTP)>
TAFSIR_MCP_TOKEN=<اختياري: رمز الدخول إن طلبه الخادم>
```

**ملاحظة على الإحالة:** خادم Tafsir MCP يعطي نص التفسير لكل آية دون رقم جزء أو صفحة. لذلك تكون الإحالة في السؤال المولَّد: اسم التفسير، و«تفسير الآية س:آ» في حقل الصفحة، والاقتباس الحرفي في `source_excerpt`.

**خارج نطاق هذه الخطة:** التوليد الدفعي لسور كاملة، وحفظ سجل لكل طلب توليد وتكلفته، ومصادر غير المختصر والسعدي.

---

## خريطة الملفات

```
quran-quiz/
├── supabase/
│   ├── migrations/20261121000100_source_excerpt.sql   عمود الاقتباس وقفله
│   └── tests/database/07_generation.test.sql
└── admin/src/
    ├── lib/
    │   ├── arabic.ts (+ test)                تطبيع النص العربي والبحث عن الاقتباس
    │   ├── generation-schema.ts              صيغة مخرجات Claude (Zod 4)
    │   ├── generation.ts (+ test)            الطلب، وبناء التعليمات، وفحص المقترحات، والتنسيق بينها
    │   ├── tafsir-mcp.ts (+ test)            مصدر التفسير عبر MCP
    │   └── claude.ts                         استدعاء Claude
    ├── components/AppHeader.tsx              (تعديل) رابط «توليد مساعَد»
    └── app/questions/
        ├── generate/page.tsx, GenerateForm.tsx, actions.ts
        └── [id]/page.tsx                     (تعديل) عرض الاقتباس للمراجع
```

---

### المهمة 1: عمود الاقتباس في القاعدة

**الملفات:**
- إنشاء: `supabase/migrations/20261121000100_source_excerpt.sql`
- اختبار: `supabase/tests/database/07_generation.test.sql`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`supabase/tests/database/07_generation.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'writer@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit,
    source_book, source_page, surah, ayah, origin, source_excerpt)
  values ('10000000-0000-0000-0000-000000000001', 'ما معنى الصمد؟', 'mcq', 2, 'beginner', '["أ","ب","ج","د"]', '0',
    'فائدة', 'المختصر في تفسير القرآن الكريم (عربي)', 'تفسير الآية 112:2', 112, 2, 'ai', 'الذي تصمد إليه الخلائق')
$$, 'a generated draft keeps its excerpt');

select throws_ok($$
  insert into public.questions (prompt, type, category_id, difficulty, options, correct_answer, benefit,
    source_book, source_page, source_excerpt)
  values ('سؤال', 'true_false', 1, 'beginner', null, 'true', 'فائدة', 'مصدر', '1', 'اقتباس')
$$, '23514', null, 'a human question cannot carry a generation excerpt');

update public.questions set source_excerpt = 'اقتباس آخر', origin = 'human'
where id = '10000000-0000-0000-0000-000000000001';
select is((select source_excerpt from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'الذي تصمد إليه الخلائق', 'the excerpt cannot be edited');
select is((select origin::text from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'ai', 'the generated mark cannot be removed');

select * from finish();
rollback;
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npx supabase test db
```

المتوقع: FAIL في `07_generation.test.sql`، والسبب `column "source_excerpt" ... does not exist`.

- [ ] **الخطوة 3: كتابة الترحيل**

`supabase/migrations/20261121000100_source_excerpt.sql`:

```sql
alter table public.questions
  add column source_excerpt text,
  add constraint questions_excerpt_only_ai check (source_excerpt is null or origin = 'ai');

-- نسخة من حارس الخطة 1 مع قفل الاقتباس.
create or replace function public.guard_question_update() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.in_transition', true), '') <> 'on' then
    if new.status is distinct from old.status then
      raise exception 'لا تتغير حالة السؤال إلا عبر مسار المراجعة';
    end if;
    new.author_id := old.author_id;
    new.origin := old.origin;
    new.source_excerpt := old.source_excerpt;
    new.reviewer_id := old.reviewer_id;
    new.review_notes := old.review_notes;
    new.approved_at := old.approved_at;
    new.published_at := old.published_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
```

- [ ] **الخطوة 4: التطبيق والاختبار**

```bash
npx supabase db reset
npx supabase test db
```

المتوقع: `All tests successful` للملفات السبعة.

- [ ] **الخطوة 5: Commit**

```bash
git add supabase
git commit -m "feat(db): locked source excerpt for generated questions"
```

---

### المهمة 2: تطبيع النص العربي

يكتب Claude الاقتباس أحيانًا بلا تشكيل أو بهمزة مختلفة، ونص التفسير فيه أقواس ورموز تنسيق (`{...}` و`_..._`). المقارنة تكون بعد تطبيع الطرفين: حذف التشكيل والتطويل والرموز، وتوحيد الألف والياء والتاء المربوطة والمسافات.

**الملفات:**
- إنشاء: `admin/src/lib/arabic.ts`
- اختبار: `admin/src/lib/arabic.test.ts`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`admin/src/lib/arabic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeArabic, containsQuote } from './arabic';

const SAADI = '{اللَّهُ الصَّمَدُ (2)}.\n{2} {اللهُ الصمدُ}؛ أي: المقصود في جميع الحوائج؛ فأهل العالم العلويِّ والسفليِّ مفتقرون إليه غاية الافتقار';
const MUKHTASAR = 'قل - أيها الرسول -: _هو الله المنفرد بالألوهية_، لا إله غيره.';

describe('normalizeArabic', () => {
  it('drops diacritics, tatweel, symbols and unifies letter forms', () => {
    expect(normalizeArabic('اللَّهُ الصَّمَدُ')).toBe('الله الصمد');
    expect(normalizeArabic('إِلَـٰهٌ  أحدٌ، مكيّة')).toBe('اله احد مكيه');
    expect(normalizeArabic('{هو} _الله_ (1)')).toBe('هو الله 1');
  });
});

describe('containsQuote', () => {
  it('finds a quote regardless of diacritics and punctuation', () => {
    expect(containsQuote(SAADI, 'المقصود في جميع الحوائج')).toBe(true);
    expect(containsQuote(SAADI, 'فأهل العالم العلوي والسفلي مفتقرون إليه')).toBe(true);
    expect(containsQuote(MUKHTASAR, 'هو الله المنفرد بالألوهية')).toBe(true);
  });

  it('rejects paraphrases and quotes too short to prove anything', () => {
    expect(containsQuote(SAADI, 'المقصود في كل الحاجات')).toBe(false);
    expect(containsQuote(SAADI, 'الصمد')).toBe(false);
  });
});
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
cd admin && npm test -- src/lib/arabic.test.ts
```

المتوقع: FAIL، والسبب `Cannot find module './arabic'`.

- [ ] **الخطوة 3: كتابة التنفيذ**

`admin/src/lib/arabic.ts`:

```ts
// التشكيل وعلامات القرآن والتطويل.
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalizeArabic(text: string): string {
  return text
    .replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export const MIN_QUOTE_LENGTH = 10;

// هل ورد الاقتباس في النص حرفيًا (بعد التطبيع)؟ ويُشترط طول يكفي ليكون دليلًا.
export function containsQuote(source: string, quote: string): boolean {
  const q = normalizeArabic(quote);
  if (q.length < MIN_QUOTE_LENGTH) return false;
  return ` ${normalizeArabic(source)} `.includes(` ${q} `);
}
```

- [ ] **الخطوة 4: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test -- src/lib/arabic.test.ts
```

- [ ] **الخطوة 5: Commit**

```bash
git add src/lib/arabic.ts src/lib/arabic.test.ts
git commit -m "feat(admin): arabic normalisation for quote checks"
```

---

### المهمة 3: الطلب والتعليمات وفحص المقترحات

**الملفات:**
- إنشاء: `admin/src/lib/generation-schema.ts`، `admin/src/lib/generation.ts`
- اختبار: `admin/src/lib/generation.test.ts`

- [ ] **الخطوة 1: صيغة مخرجات Claude**

مساعد المخرجات المنظّمة في `@anthropic-ai/sdk` يعمل بـ Zod 4، وهو متاح في حزمة zod الحالية عبر `zod/v4`.

`admin/src/lib/generation-schema.ts`:

```ts
import * as z from 'zod/v4';

export const TAFSIR_SOURCES = ['mukhtasar_ar', 'saadi'] as const;
export type TafsirSourceId = (typeof TAFSIR_SOURCES)[number];

export const proposalSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(['mcq', 'true_false']),
      prompt: z.string(),
      options: z.array(z.string()),
      correct_option: z.number().int().nullable(),
      correct_bool: z.boolean().nullable(),
      benefit: z.string(),
      source: z.enum(TAFSIR_SOURCES),
      surah: z.number().int(),
      ayah: z.number().int(),
      evidence: z.string(),
    }),
  ),
});

export type Proposal = z.infer<typeof proposalSchema>;
export type ProposedQuestion = Proposal['questions'][number];
```

- [ ] **الخطوة 2: كتابة الاختبار الفاشل**

`admin/src/lib/generation.test.ts`:

```ts
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
```

- [ ] **الخطوة 3: تشغيله والتأكد من فشله**

```bash
npm test -- src/lib/generation.test.ts
```

المتوقع: FAIL، والسبب `Cannot find module './generation'`.

- [ ] **الخطوة 4: كتابة التنفيذ**

`admin/src/lib/generation.ts`:

```ts
import { z } from 'zod';
import { containsQuote, normalizeArabic } from './arabic';
import { DIFFICULTY_LABELS, type Difficulty } from './question-schema';
import type { Proposal, ProposedQuestion, TafsirSourceId } from './generation-schema';

export class GenerationError extends Error {}

export const CATEGORY_NAMES: Record<number, string> = {
  1: 'التفسير',
  2: 'معاني الكلمات',
  3: 'قصص القرآن',
  4: 'قصص الأنبياء',
};

export const MAX_AYAT = 5;
export const MAX_QUESTIONS = 5;

export type AyahContext = {
  surah: number;
  ayah: number;
  text: string;
  tafsirs: { source: TafsirSourceId; attribution: string; text: string }[];
};

export interface TafsirSource {
  getAyah(surah: number, ayah: number): Promise<AyahContext>;
}

export type Prompt = { system: string; user: string };

const requestSchema = z
  .object({
    surah: z.number({ invalid_type_error: 'اختر السورة' }).int().min(1, 'رقم السورة بين 1 و114').max(114, 'رقم السورة بين 1 و114'),
    fromAyah: z.number({ invalid_type_error: 'حدّد أول آية' }).int().min(1, 'رقم الآية يبدأ من 1'),
    toAyah: z.number({ invalid_type_error: 'حدّد آخر آية' }).int().min(1, 'رقم الآية يبدأ من 1'),
    categoryId: z.number({ invalid_type_error: 'اختر التصنيف' }).int().min(1).max(4),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced'], { errorMap: () => ({ message: 'اختر المستوى' }) }),
    count: z.number().int().min(1, 'من سؤال إلى خمسة').max(MAX_QUESTIONS, 'من سؤال إلى خمسة'),
  })
  .refine((r) => r.toAyah >= r.fromAyah && r.toAyah - r.fromAyah < MAX_AYAT, {
    path: ['toAyah'],
    message: 'اختر من آية إلى خمس آيات',
  });

export type GenerateRequest = z.infer<typeof requestSchema>;

export function parseGenerateForm(fd: FormData) {
  const num = (key: string) => {
    const s = String(fd.get(key) ?? '').trim();
    return s === '' ? null : Number(s);
  };
  return requestSchema.safeParse({
    surah: num('surah'),
    fromAyah: num('fromAyah'),
    toAyah: num('toAyah'),
    categoryId: num('categoryId'),
    difficulty: String(fd.get('difficulty') ?? ''),
    count: num('count'),
  });
}

const SYSTEM = `أنت تساعد الفريق العلمي في مركز تفسير على إعداد مسودات أسئلة لمسابقة قرآنية. ستُعطى آيات ونص تفسيرها من «المختصر في تفسير القرآن الكريم» و«تيسير الكريم الرحمن» للسعدي. يراجع كل مسودة مراجع علمي قبل نشرها، فاجعل مراجعتها سهلة ومضمونة:

- ابنِ كل سؤال على معنى صرّح به أحد التفسيرين المعطَيين، لا على معلومات من خارجهما.
- في evidence انقل حرفيًا عبارة من نص ذلك التفسير (جملة أو جزء جملة) تثبت الإجابة الصحيحة، وفي source مصدرها، وفي surah وayah الآية التي فُسّرت. أي سؤال لا يوجد اقتباسه حرفيًا في التفسير المنسوب إليه يُرفض آليًا.
- إن ذكرت ألفاظًا من القرآن في نص السؤال فضعها بين ﴿ ﴾ وانقلها كما وردت في نص الآية المعطى. لا تضع نصًا قرآنيًا في الخيارات، ولا تختلق نصًا قرآنيًا.
- الخيارات الخاطئة معقولة لكنها خاطئة بوضوح بحسب التفسير، والخيارات الأربعة مختلفة.
- الفائدة جملة أو جملتان (أقل من 300 حرف) تشرح الإجابة لمن أخطأ.
- المستوى: «مبتدئ» معنى ظاهر من التفسير، «متوسط» معنى يحتاج قراءة التفسير، «متقدم» دقائق المعنى والفروق.
- الاختيار من متعدد (mcq): أربعة options، وcorrect_option رقم الصحيح من 0 إلى 3، وcorrect_bool قيمته null. صواب أو خطأ (true_false): options فارغة، وcorrect_option قيمته null، وcorrect_bool هو الإجابة.

اقترح العدد المطلوب، أو أقل إن لم يحتمل النص أسئلة جيدة بهذا العدد.`;

export function buildPrompt(r: GenerateRequest, contexts: AyahContext[]): Prompt {
  const ayat = contexts
    .map((c) => {
      const tafsirs = c.tafsirs
        .map((t) => `<tafsir source="${t.source}" name="${t.attribution}">\n${t.text}\n</tafsir>`)
        .join('\n');
      return `<ayah surah="${c.surah}" number="${c.ayah}">\n<text>${c.text}</text>\n${tafsirs}\n</ayah>`;
    })
    .join('\n\n');
  const user = `اقترح ${r.count} أسئلة بمستوى «${DIFFICULTY_LABELS[r.difficulty as Difficulty]}» في تصنيف «${CATEGORY_NAMES[r.categoryId]}»، ونوّع بين الاختيار من متعدد وصواب أو خطأ.

<ayat>
${ayat}
</ayat>`;
  return { system: SYSTEM, user };
}

export type DraftRow = {
  prompt: string;
  type: 'mcq' | 'true_false';
  category_id: number;
  difficulty: Difficulty;
  options: string[] | null;
  correct_answer: number | boolean;
  benefit: string;
  source_book: string;
  source_volume: null;
  source_page: string;
  surah: number;
  ayah: number;
  origin: 'ai';
  source_excerpt: string;
};

export type Rejection = { prompt: string; reason: string };

const QURAN_SPAN = /﴿([^﴾]*)﴾/g;

function check(q: ProposedQuestion, contexts: AyahContext[], r: GenerateRequest): string | null {
  if (!q.prompt.trim() || !q.benefit.trim()) return 'نص السؤال والفائدة مطلوبان';
  if (q.benefit.length > 300) return 'الفائدة أطول من 300 حرف';

  const ctx = contexts.find((c) => c.surah === q.surah && c.ayah === q.ayah);
  if (q.surah !== r.surah || q.ayah < r.fromAyah || q.ayah > r.toAyah || !ctx) return 'السؤال خارج الآيات المطلوبة';

  const tafsir = ctx.tafsirs.find((t) => t.source === q.source);
  if (!tafsir || !containsQuote(tafsir.text, q.evidence)) return 'الاقتباس غير موجود حرفيًا في التفسير المنسوب إليه';

  if (q.options.some((o) => /[﴿﴾{}]/.test(o))) return 'لا يُكتب نص قرآني في الخيارات';
  const ayahText = ` ${normalizeArabic(ctx.text)} `;
  for (const [, quoted] of q.prompt.matchAll(QURAN_SPAN)) {
    const n = normalizeArabic(quoted);
    if (!n || !ayahText.includes(` ${n} `)) return 'النص القرآني في السؤال لا يطابق نص الآية';
  }

  if (q.type === 'mcq') {
    const opts = q.options.map((o) => o.trim());
    if (opts.length !== 4 || opts.some((o) => !o) || new Set(opts).size !== 4) {
      return 'الاختيار من متعدد يحتاج أربعة خيارات مختلفة غير فارغة';
    }
    if (q.correct_option === null || q.correct_option < 0 || q.correct_option > 3) return 'حدّد الخيار الصحيح';
  } else if (q.correct_bool === null) {
    return 'حدّد إجابة صواب أو خطأ';
  }
  return null;
}

export function reviewProposal(p: Proposal, contexts: AyahContext[], r: GenerateRequest) {
  const accepted: DraftRow[] = [];
  const rejected: Rejection[] = [];
  for (const q of p.questions) {
    const reason = check(q, contexts, r);
    if (reason) {
      rejected.push({ prompt: q.prompt, reason });
      continue;
    }
    if (accepted.length >= r.count) continue;
    const tafsir = contexts.find((c) => c.ayah === q.ayah)!.tafsirs.find((t) => t.source === q.source)!;
    accepted.push({
      prompt: q.prompt.trim(),
      type: q.type,
      category_id: r.categoryId,
      difficulty: r.difficulty as Difficulty,
      options: q.type === 'mcq' ? q.options.map((o) => o.trim()) : null,
      correct_answer: q.type === 'mcq' ? q.correct_option! : q.correct_bool!,
      benefit: q.benefit.trim(),
      source_book: tafsir.attribution,
      source_volume: null,
      source_page: `تفسير الآية ${q.surah}:${q.ayah}`,
      surah: q.surah,
      ayah: q.ayah,
      origin: 'ai',
      source_excerpt: q.evidence.trim(),
    });
  }
  return { accepted, rejected };
}

export async function generateDrafts(
  r: GenerateRequest,
  deps: { source: TafsirSource; propose: (prompt: Prompt) => Promise<Proposal> },
) {
  const ayat = Array.from({ length: r.toAyah - r.fromAyah + 1 }, (_, i) => r.fromAyah + i);
  const contexts = await Promise.all(ayat.map((a) => deps.source.getAyah(r.surah, a)));
  const proposal = await deps.propose(buildPrompt(r, contexts));
  return reviewProposal(proposal, contexts, r);
}
```

- [ ] **الخطوة 5: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test -- src/lib/generation.test.ts
```

- [ ] **الخطوة 6: Commit**

```bash
git add src/lib/generation-schema.ts src/lib/generation.ts src/lib/generation.test.ts
git commit -m "feat(admin): generation prompt and proposal checks"
```

---

### المهمة 4: مصدر التفسير عبر MCP

أداتا الخادم: `fetch_ayah(surah, ayah)` تُرجع `text` و`text_uthmani`، و`fetch_tafsir(surah, ayah, sources, part)` تُرجع `tafsirs[]`، ولكل عنصر `source` و`attribution` و`text`، ويحمل النص الطويل `has_more`، فتُطلب أجزاؤه التالية بزيادة `part`. والنتيجة تصل في `structuredContent` أو نصًّا JSON في `content`.

**الملفات:**
- إنشاء: `admin/src/lib/tafsir-mcp.ts`
- اختبار: `admin/src/lib/tafsir-mcp.test.ts`

- [ ] **الخطوة 1: تثبيت الحزم**

```bash
npm install @anthropic-ai/sdk @modelcontextprotocol/sdk
```

- [ ] **الخطوة 2: كتابة الاختبار الفاشل**

`admin/src/lib/tafsir-mcp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createTafsirSource, readToolPayload } from './tafsir-mcp';
import { GenerationError } from './generation';

describe('readToolPayload', () => {
  it('prefers structured content and falls back to JSON text', () => {
    expect(readToolPayload({ structuredContent: { a: 1 }, content: [] })).toEqual({ a: 1 });
    expect(readToolPayload({ content: [{ type: 'text', text: '{"b":2}' }] })).toEqual({ b: 2 });
  });

  it('raises tool errors', () => {
    expect(() => readToolPayload({ isError: true, content: [{ type: 'text', text: 'surah out of range' }] })).toThrow(
      GenerationError,
    );
  });
});

describe('createTafsirSource', () => {
  it('reads the ayah and both tafsirs, joining long tafsir parts', async () => {
    const calls: string[] = [];
    const source = createTafsirSource(async (name, args) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      if (name === 'fetch_ayah') return { surah: 112, ayah: 1, text: 'قل هو الله أحد', text_uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ' };
      const [src] = args.sources as string[];
      if (src === 'mukhtasar_ar') {
        return { tafsirs: [{ source: 'mukhtasar_ar', attribution: 'المختصر', text: 'هو الله المنفرد بالألوهية' }] };
      }
      return args.part === 1
        ? { tafsirs: [{ source: 'saadi', attribution: 'السعدي', text: 'الجزء الأول ', part: 1, total_parts: 2, has_more: true }] }
        : { tafsirs: [{ source: 'saadi', attribution: 'السعدي', text: 'الجزء الثاني', part: 2, total_parts: 2, has_more: false }] };
    });

    expect(await source.getAyah(112, 1)).toEqual({
      surah: 112,
      ayah: 1,
      text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      tafsirs: [
        { source: 'mukhtasar_ar', attribution: 'المختصر', text: 'هو الله المنفرد بالألوهية' },
        { source: 'saadi', attribution: 'السعدي', text: 'الجزء الأول الجزء الثاني' },
      ],
    });
    expect(calls.filter((c) => c.includes('"saadi"'))).toHaveLength(2);
  });

  it('reports a missing ayah in Arabic', async () => {
    const source = createTafsirSource(async () => ({}));
    await expect(source.getAyah(1, 99)).rejects.toThrow('الآية 1:99 غير موجودة');
  });
});
```

- [ ] **الخطوة 3: تشغيله والتأكد من فشله**

```bash
npm test -- src/lib/tafsir-mcp.test.ts
```

المتوقع: FAIL، والسبب `Cannot find module './tafsir-mcp'`.

- [ ] **الخطوة 4: كتابة التنفيذ**

`admin/src/lib/tafsir-mcp.ts`:

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { GenerationError, type AyahContext, type TafsirSource } from './generation';
import { TAFSIR_SOURCES } from './generation-schema';

export type CallTool = (name: string, args: Record<string, unknown>) => Promise<unknown>;

type ToolResult = {
  isError?: boolean;
  structuredContent?: unknown;
  content?: { type: string; text?: string }[];
};

const MAX_PARTS = 20;

export function readToolPayload(result: ToolResult): unknown {
  const text = (result.content ?? []).find((c) => c.type === 'text')?.text ?? '';
  if (result.isError) throw new GenerationError(`خادم التفسير أعاد خطأ: ${text}`);
  if (result.structuredContent) return result.structuredContent;
  try {
    return JSON.parse(text);
  } catch {
    throw new GenerationError('رد خادم التفسير بصيغة غير متوقعة');
  }
}

type TafsirEntry = { source: string; attribution: string; text: string; has_more?: boolean };

export function createTafsirSource(call: CallTool): TafsirSource {
  return {
    async getAyah(surah, ayah) {
      const a = (await call('fetch_ayah', { surah, ayah })) as { text?: string; text_uthmani?: string };
      if (!a?.text) throw new GenerationError(`الآية ${surah}:${ayah} غير موجودة`);

      const tafsirs: AyahContext['tafsirs'] = [];
      for (const source of TAFSIR_SOURCES) {
        let text = '';
        let attribution = '';
        for (let part = 1; part <= MAX_PARTS; part++) {
          const r = (await call('fetch_tafsir', { surah, ayah, sources: [source], part })) as { tafsirs?: TafsirEntry[] };
          const entry = r?.tafsirs?.find((t) => t.source === source);
          if (!entry) break;
          attribution = entry.attribution;
          text += entry.text;
          if (!entry.has_more) break;
        }
        if (text) tafsirs.push({ source, attribution, text });
      }
      if (tafsirs.length === 0) throw new GenerationError(`لا يوجد تفسير للآية ${surah}:${ayah} في المختصر ولا السعدي`);

      return { surah, ayah, text: a.text_uthmani || a.text, tafsirs };
    },
  };
}

export async function connectTafsirMcp(url: string, token?: string) {
  const client = new Client({ name: 'quran-quiz-admin', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(url),
    token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined,
  );
  await client.connect(transport);
  const call: CallTool = async (name, args) => readToolPayload((await client.callTool({ name, arguments: args })) as ToolResult);
  return { source: createTafsirSource(call), close: () => client.close() };
}
```

- [ ] **الخطوة 5: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test -- src/lib/tafsir-mcp.test.ts
```

- [ ] **الخطوة 6: Commit**

```bash
git add package.json package-lock.json src/lib/tafsir-mcp.ts src/lib/tafsir-mcp.test.ts
git commit -m "feat(admin): tafsir source over MCP"
```

---

### المهمة 5: استدعاء Claude

طلب واحد بمخرجات منظّمة عبر `messages.parse`. يُستعمل `claude-opus-5-5` بجهد `high` لأن جودة السؤال أهم من سرعته. ويُفعَّل البديل الآلي (`fallbacks: 'default'`): إن رفض النموذج الطلب لسبب أمني يعيد الخادم الطلب نفسه على نموذج بديل داخل الاستدعاء نفسه.

**الملفات:**
- إنشاء: `admin/src/lib/claude.ts`

- [ ] **الخطوة 1: كتابة التنفيذ**

`admin/src/lib/claude.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { proposalSchema, type Proposal } from './generation-schema';
import { GenerationError, type Prompt } from './generation';

export const GENERATION_MODEL = 'claude-opus-5-5';

export async function proposeWithClaude(prompt: Prompt, client = new Anthropic()): Promise<Proposal> {
  const response = await client.beta.messages.parse({
    model: GENERATION_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(proposalSchema) },
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });

  if (response.stop_reason === 'refusal') throw new GenerationError('اعتذر النموذج عن هذا الطلب؛ جرّب آيات أخرى');
  if (response.stop_reason === 'max_tokens') throw new GenerationError('انقطع الرد قبل اكتماله؛ قلّل عدد الأسئلة');
  if (!response.parsed_output) throw new GenerationError('رد النموذج لم يطابق الصيغة المطلوبة');
  return response.parsed_output;
}
```

- [ ] **الخطوة 2: فحص الأنواع**

```bash
npx tsc --noEmit
```

- [ ] **الخطوة 3: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat(admin): claude proposal call with structured output"
```

---

### المهمة 6: صفحة التوليد

**الملفات:**
- إنشاء: `admin/src/app/questions/generate/actions.ts`، `admin/src/app/questions/generate/GenerateForm.tsx`، `admin/src/app/questions/generate/page.tsx`
- تعديل: `admin/src/components/AppHeader.tsx`

- [ ] **الخطوة 1: الإجراء**

`admin/src/app/questions/generate/actions.ts`:

```ts
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
```

- [ ] **الخطوة 2: النموذج والنتائج**

`admin/src/app/questions/generate/GenerateForm.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { generateQuestions, type GenerateState } from './actions';
import { DIFFICULTY_LABELS } from '@/lib/question-schema';
import { CATEGORY_NAMES, MAX_QUESTIONS } from '@/lib/generation';

const inputCls = 'w-full rounded border border-gray-300 bg-white p-2';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function GenerateForm() {
  const [state, setState] = useState<GenerateState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setState(await generateQuestions(null, fd)));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="max-w-3xl space-y-4 rounded border bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="رقم السورة">
            <input name="surah" type="number" min={1} max={114} required className={inputCls} />
          </Field>
          <Field label="من الآية">
            <input name="fromAyah" type="number" min={1} required className={inputCls} />
          </Field>
          <Field label="إلى الآية (خمس آيات على الأكثر)">
            <input name="toAyah" type="number" min={1} required className={inputCls} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="التصنيف">
            <select name="categoryId" defaultValue="1" className={inputCls}>
              {Object.entries(CATEGORY_NAMES).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المستوى">
            <select name="difficulty" defaultValue="beginner" className={inputCls}>
              {Object.entries(DIFFICULTY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="عدد الأسئلة">
            <input name="count" type="number" min={1} max={MAX_QUESTIONS} defaultValue={3} required className={inputCls} />
          </Field>
        </div>
        <button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
          {pending ? 'جارٍ جلب التفسير واقتراح الأسئلة… قد يستغرق دقيقة' : 'اقترح أسئلة'}
        </button>
      </form>

      {state?.errors.length ? (
        <ul className="list-disc rounded border border-red-300 bg-red-50 p-3 ps-8 text-red-800">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      {state?.created && (
        <section className="space-y-2">
          <h2 className="font-bold">مسودات حُفظت ({state.created.length})</h2>
          {state.created.length === 0 ? (
            <p className="text-sm text-gray-600">لم يجتز أي مقترح الفحص الآلي.</p>
          ) : (
            <ul className="list-disc space-y-1 ps-6">
              {state.created.map((q) => (
                <li key={q.id}>
                  <Link href={`/questions/${q.id}`} className="text-blue-800 hover:underline">
                    {q.prompt}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {state?.rejected && state.rejected.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">مقترحات رُفضت آليًا ({state.rejected.length})</h2>
          <ul className="space-y-1 text-sm">
            {state.rejected.map((r, i) => (
              <li key={i} className="rounded border bg-white p-2">
                <span className="text-gray-800">{r.prompt}</span>
                <span className="ms-2 text-red-700">({r.reason})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **الخطوة 3: الصفحة**

`admin/src/app/questions/generate/page.tsx`:

```tsx
import { GenerateForm } from './GenerateForm';

// طلب Claude قد يطول؛ هذا يرفع مهلة الإجراء عند النشر على منصات تحدّها.
export const maxDuration = 300;

export default function GeneratePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">توليد مساعَد</h1>
      <p className="max-w-3xl text-sm text-gray-600">
        يجلب النظام نص الآيات وتفسيرها من «المختصر في تفسير القرآن الكريم» و«تفسير السعدي»، ثم يقترح Claude أسئلة لكل منها
        اقتباس حرفي من التفسير. يُرفض آليًا كل مقترح لا يوجد اقتباسه في التفسير، وما يجتاز الفحص يُحفظ مسودةً بعلامة
        «مولَّد آليًا» ولا يُنشر إلا بعد مراجعة علمية.
      </p>
      <GenerateForm />
    </div>
  );
}
```

- [ ] **الخطوة 4: رابط في الرأس**

في `admin/src/components/AppHeader.tsx`، قبل رابط «سؤال جديد» مباشرة:

```tsx
<Link href="/questions/generate" className="ms-auto text-sm text-emerald-800 hover:underline">
  توليد مساعَد
</Link>
```

واحذف `ms-auto` من رابط «سؤال جديد» ليبقيا متجاورين.

- [ ] **الخطوة 5: فحص الأنواع**

```bash
npx tsc --noEmit
```

- [ ] **الخطوة 6: Commit**

```bash
git add src
git commit -m "feat(admin): assisted generation page"
```

---

### المهمة 7: الاقتباس أمام المراجع

**الملفات:**
- تعديل: `admin/src/lib/question-schema.ts`، `admin/src/app/questions/[id]/page.tsx`، `admin/src/components/TransitionPanel.tsx`

- [ ] **الخطوة 1: النوع**

في `QuestionRow` داخل `admin/src/lib/question-schema.ts` أضف:

```ts
  source_excerpt: string | null;
```

- [ ] **الخطوة 2: صندوق الاقتباس**

في `admin/src/app/questions/[id]/page.tsx`، بعد كتلة `review_notes` مباشرة:

```tsx
{q.source_excerpt && (
  <figure className="rounded border border-emerald-200 bg-emerald-50 p-3">
    <figcaption className="mb-1 text-sm font-medium text-emerald-900">
      الاقتباس الذي بُني عليه السؤال: {q.source_book}، {q.source_page}
    </figcaption>
    <blockquote className="text-gray-900">«{q.source_excerpt}»</blockquote>
  </figure>
)}
```

- [ ] **الخطوة 3: تذكير المراجع بالمطابقة**

`TransitionPanel` يأخذ خاصية `generated?: boolean`، وفوق الأزرار، حين يكون الاعتماد متاحًا:

```tsx
{generated && targets.includes('approved') && (
  <p className="text-sm text-amber-800">سؤال مولَّد آليًا: طابِق الإجابة بالاقتباس والتفسير قبل الاعتماد.</p>
)}
```

وتمرَّر من صفحة السؤال: `generated={q.origin === 'ai'}`.

- [ ] **الخطوة 4: فحص الأنواع والاختبارات والبناء**

```bash
npx tsc --noEmit && npm test && npm run build
```

- [ ] **الخطوة 5: Commit**

```bash
git add src
git commit -m "feat(admin): show generation excerpt to reviewers"
```

---

### المهمة 8: تجربة المسار كاملًا

- [ ] **الخطوة 1: التشغيل بالخدمتين الحقيقيتين**

اضبط `ANTHROPIC_API_KEY` و`TAFSIR_MCP_URL` في `.env.local`، ثم:

```bash
npm run build && npm run start
```

- [ ] **الخطوة 2: تنفيذ القائمة والتأكد من كل بند**

1. بحساب الكاتب: افتح «توليد مساعَد»، واختر سورة الإخلاص من 1 إلى 4، «معاني الكلمات»، «مبتدئ»، 3 أسئلة. المتوقع: بعد دقيقة على الأكثر تظهر قائمة «مسودات حُفظت» بروابطها، وقد تظهر مقترحات مرفوضة مع أسبابها.
2. افتح مسودة. المتوقع: شارة «مولَّد آليًا»، وصندوق الاقتباس باسم التفسير و«تفسير الآية 112:…»، والاقتباس موجود فعلًا في تفسير تلك الآية.
3. اختر من 1 إلى 7. المتوقع: «اختر من آية إلى خمس آيات» دون أي طلب للخدمتين.
4. اختر سورة 1 من الآية 8 إلى 9. المتوقع: «الآية 1:8 غير موجودة».
5. بحساب المراجع: جرّب التوليد. المتوقع: «التوليد للكتّاب والمدير». ثم افتح مسودة مرسلة للمراجعة. المتوقع: تذكير «طابِق الإجابة بالاقتباس…» فوق زر الاعتماد.
6. أرسل المسودة للمراجعة، واعتمدها بحساب المراجع، وانشرها بحساب المدير. المتوقع: المسار المعتاد يعمل كما في الخطة 1.
7. أزل `TAFSIR_MCP_URL` وأعد التشغيل. المتوقع: «التوليد غير مهيأ: اضبط TAFSIR_MCP_URL».

- [ ] **الخطوة 3: Commit الخطة**

```bash
git add docs/superpowers/plans/2026-11-21-assisted-generation.md
git commit -m "docs: assisted generation plan"
```

---

## المراجعة الذاتية

**تغطية التصميم:** يختار الكاتب آية أو مقطعًا (المهمة 6)، ويجلب النظام نصها وكلام المفسرين من المصادر المعتمدة (المهمة 4)، ويقترح مسودات مع إحالة كل سؤال إلى موضعه في التفسير (المهام 3 و5 و7)، بعلامة «مولَّد آليًا» لا تُزال (المهمة 1)، ولا تُعتمد إلا بقرار بشري (مسار الخطة 1 دون تغيير).

**الضوابط القرآنية:** لا نص قرآني في الخيارات، وما يُقتبس من الآية في نص السؤال يُطابَق بنص الآية المجلوب من المصدر (المهمة 3). ونص الآية نفسه يأتي من الخادم لا من النموذج.

**الحماية من الاختلاق:** لا يُحفظ سؤال إلا إن وُجد اقتباسه حرفيًا في نص التفسير الذي نسبه إليه، فيرى المراجع الدليل بجانب السؤال.

**اتساق الأسماء:** حقول `proposalSchema` هي ما يقرؤه `reviewProposal`، وأعمدة `DraftRow` هي أعمدة جدول `questions`، و`TAFSIR_SOURCES` واحدة في التعليمات والعميل والفحص.
