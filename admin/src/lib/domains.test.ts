import { describe, it, expect } from 'vitest';
import { normalizeDomain } from './domains';

describe('normalizeDomain', () => {
  it.each([
    ['YouTube.com', 'youtube.com'],
    ['  tafsir.net ', 'tafsir.net'],
    ['https://www.tafsir.net/videos/1', 'tafsir.net'],
    ['www.tafsir.net', 'tafsir.net'],
    ['cdn.tafsir.net/', 'cdn.tafsir.net'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each([[''], ['not a domain'], ['localhost'], ['http://x'], ['-bad-.com']])('rejects %j', (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});
