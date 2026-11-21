import { describe, it, expect } from 'vitest';
import { parseDraftFile } from './draft-file';

const valid = {
  request: { surah: 112, fromAyah: 1, toAyah: 2, categoryId: 2, difficulty: 'beginner', count: 1 },
  questions: [
    {
      type: 'true_false',
      prompt: 'سؤال',
      options: [],
      correct_option: null,
      correct_bool: true,
      benefit: 'فائدة',
      source: 'saadi',
      surah: 112,
      ayah: 1,
      evidence: 'اقتباس',
    },
  ],
};

describe('parseDraftFile', () => {
  it('reads the request and the proposed questions', () => {
    const { request, proposal } = parseDraftFile(valid);
    expect(request.surah).toBe(112);
    expect(proposal.questions).toHaveLength(1);
  });

  it('explains what is wrong with a malformed file', () => {
    expect(() => parseDraftFile({ ...valid, request: { ...valid.request, toAyah: 9 } })).toThrow('اختر من آية إلى خمس آيات');
    expect(() => parseDraftFile({ request: valid.request, questions: [{ prompt: 'ناقص' }] })).toThrow('صيغة الأسئلة غير صحيحة');
  });
});
