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

  it('ignores manuscript variant notes inside the source', () => {
    const withVariant = 'وإنعامه عليهم بالنعم ¬في (ب): «النعم».¥ العظيمة، التي لو فقدوها لم يمكن لهم البقاء';
    expect(containsQuote(withVariant, 'وإنعامه عليهم بالنعم العظيمة')).toBe(true);
  });

  it('rejects paraphrases and quotes too short to prove anything', () => {
    expect(containsQuote(SAADI, 'المقصود في كل الحاجات')).toBe(false);
    expect(containsQuote(SAADI, 'الصمد')).toBe(false);
  });
});
