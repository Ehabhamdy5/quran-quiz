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
