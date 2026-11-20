import { describe, it, expect } from 'vitest';
import { parseYouTubeId, isAllowedDomain, validateMedia, youTubeEmbedUrl, readMediaFields } from './media';

const ID = 'abcdefghijk';

describe('parseYouTubeId', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://m.youtube.com/watch?v=${ID}&t=30`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/embed/${ID}`],
  ])('extracts the id from %s', (url) => {
    expect(parseYouTubeId(url)).toBe(ID);
  });

  it('returns null for other hosts, bad ids and non-urls', () => {
    expect(parseYouTubeId('https://vimeo.com/123')).toBeNull();
    expect(parseYouTubeId('https://youtu.be/short')).toBeNull();
    expect(parseYouTubeId('not a url')).toBeNull();
  });
});

describe('isAllowedDomain', () => {
  const allowed = ['youtube.com', 'youtu.be'];

  it('accepts a listed domain and its subdomains over https', () => {
    expect(isAllowedDomain(`https://youtube.com/watch?v=${ID}`, allowed)).toBe(true);
    expect(isAllowedDomain(`https://www.youtube.com/watch?v=${ID}`, allowed)).toBe(true);
  });

  it('rejects http, look-alike hosts and unlisted sites', () => {
    expect(isAllowedDomain(`http://www.youtube.com/watch?v=${ID}`, allowed)).toBe(false);
    expect(isAllowedDomain('https://notyoutube.com/x', allowed)).toBe(false);
    expect(isAllowedDomain('https://example.com/x.mp4', allowed)).toBe(false);
  });
});

describe('validateMedia', () => {
  it('passes a valid clip', () => {
    expect(
      validateMedia(
        { url: `https://www.youtube.com/watch?v=${ID}`, kind: 'video', startSeconds: 10, endSeconds: 40, altText: 'وصف' },
        ['youtube.com'],
      ),
    ).toEqual([]);
  });

  it('reports an end before the start and a missing alt text', () => {
    const errors = validateMedia(
      { url: `https://www.youtube.com/watch?v=${ID}`, kind: 'video', startSeconds: 40, endSeconds: 10, altText: ' ' },
      ['youtube.com'],
    );
    expect(errors).toContain('وقت النهاية يجب أن يكون بعد وقت البداية');
    expect(errors).toContain('الوصف النصي البديل مطلوب');
  });

  it('rejects clip times on images', () => {
    expect(
      validateMedia(
        { url: 'https://example.org/image.png', kind: 'image', startSeconds: 5, endSeconds: null, altText: 'صورة' },
        ['example.org'],
      ),
    ).toContain('وقت البداية والنهاية للفيديو فقط');
  });
});

describe('youTubeEmbedUrl', () => {
  it('builds a privacy-enhanced embed with start, end and rel=0', () => {
    const u = new URL(youTubeEmbedUrl(ID, 10, 40));
    expect(u.hostname).toBe('www.youtube-nocookie.com');
    expect(u.pathname).toBe(`/embed/${ID}`);
    expect(u.searchParams.get('start')).toBe('10');
    expect(u.searchParams.get('end')).toBe('40');
    expect(u.searchParams.get('rel')).toBe('0');
  });
});

describe('readMediaFields', () => {
  it('returns null when no url is given', () => {
    expect(readMediaFields(new FormData(), 'question')).toBeNull();
  });

  it('reads the fields of one placement', () => {
    const fd = new FormData();
    fd.set('answer_media_url', ` https://youtu.be/${ID} `);
    fd.set('answer_media_kind', 'video');
    fd.set('answer_media_start', '5');
    fd.set('answer_media_end', '');
    fd.set('answer_media_alt', 'شرح');
    expect(readMediaFields(fd, 'answer')).toEqual({
      url: `https://youtu.be/${ID}`,
      kind: 'video',
      startSeconds: 5,
      endSeconds: null,
      altText: 'شرح',
    });
  });
});
