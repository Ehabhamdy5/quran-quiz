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
