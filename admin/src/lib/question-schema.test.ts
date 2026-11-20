import { describe, it, expect } from 'vitest';
import { parseQuestionForm, toRow } from './question-schema';

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

const base = {
  prompt: 'سؤال',
  categoryId: '1',
  difficulty: 'beginner',
  benefit: 'فائدة',
  sourceBook: 'مصدر',
  sourceVolume: '',
  sourcePage: '12',
  surah: '',
  ayah: '',
};

const messages = (r: ReturnType<typeof parseQuestionForm>) =>
  r.success ? [] : r.error.issues.map((i) => i.message);

describe('parseQuestionForm', () => {
  it('accepts a complete multiple-choice question', () => {
    const r = parseQuestionForm(form({ ...base, type: 'mcq', option: ['أ', 'ب', 'ج', 'د'], correct: '2' }));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(toRow(r.data)).toMatchObject({
        type: 'mcq',
        options: ['أ', 'ب', 'ج', 'د'],
        correct_answer: 2,
        source_volume: null,
        surah: null,
        ayah: null,
      });
    }
  });

  it('rejects a multiple-choice question with an empty option', () => {
    const r = parseQuestionForm(form({ ...base, type: 'mcq', option: ['أ', '', 'ج', 'د'], correct: '0' }));
    expect(messages(r)).toContain('أدخل أربعة خيارات غير فارغة');
  });

  it('rejects a multiple-choice question with no correct answer', () => {
    const r = parseQuestionForm(form({ ...base, type: 'mcq', option: ['أ', 'ب', 'ج', 'د'] }));
    expect(messages(r)).toContain('اختر الإجابة الصحيحة');
  });

  it('stores true/false answers as booleans with no options', () => {
    const r = parseQuestionForm(form({ ...base, type: 'true_false', correct: 'false' }));
    expect(r.success).toBe(true);
    if (r.success) expect(toRow(r.data)).toMatchObject({ options: null, correct_answer: false });
  });

  it('keeps ordering items in order and drops empty inputs', () => {
    const r = parseQuestionForm(form({ ...base, type: 'ordering', option: ['أول', 'ثان', 'ثالث', '', '', ''] }));
    expect(r.success).toBe(true);
    if (r.success) expect(toRow(r.data)).toMatchObject({ options: ['أول', 'ثان', 'ثالث'], correct_answer: null });
  });

  it('requires surah and ayah together', () => {
    const r = parseQuestionForm(form({ ...base, type: 'true_false', correct: 'true', surah: '12' }));
    expect(messages(r)).toContain('أدخل السورة والآية معًا أو اتركهما معًا');
  });
});
