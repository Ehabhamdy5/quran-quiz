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

export const requestSchema = z
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
