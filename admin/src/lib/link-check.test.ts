import { describe, it, expect } from 'vitest';
import { checkMediaUrl, runLinkCheck } from './link-check';

const ID = 'abcdefghijk';

function fakeFetch(statusFor: (url: string, method: string) => number | Error) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    const s = statusFor(url, method);
    if (s instanceof Error) throw s;
    return new Response(null, { status: s });
  }) as typeof fetch;
  return { impl, calls };
}

describe('checkMediaUrl', () => {
  it('asks YouTube oEmbed about YouTube links', async () => {
    const f = fakeFetch(() => 200);
    expect(await checkMediaUrl(`https://youtu.be/${ID}`, f.impl)).toEqual({ status: 'ok' });
    expect(f.calls[0]).toContain('https://www.youtube.com/oembed?format=json&url=');
    expect(f.calls[0]).toContain(encodeURIComponent(`https://www.youtube.com/watch?v=${ID}`));
  });

  it('reports removed and private YouTube videos as broken', async () => {
    expect(await checkMediaUrl(`https://youtu.be/${ID}`, fakeFetch(() => 404).impl)).toEqual({
      status: 'broken',
      error: 'الفيديو غير موجود على يوتيوب',
    });
    expect(await checkMediaUrl(`https://youtu.be/${ID}`, fakeFetch(() => 401).impl)).toEqual({
      status: 'broken',
      error: 'الفيديو خاص أو يمنع التضمين',
    });
  });

  it('checks other links with HEAD, falling back to GET', async () => {
    expect(await checkMediaUrl('https://cdn.tafsir.net/a.png', fakeFetch(() => 200).impl)).toEqual({ status: 'ok' });
    const f = fakeFetch((_, method) => (method === 'HEAD' ? 405 : 206));
    expect(await checkMediaUrl('https://cdn.tafsir.net/a.mp4', f.impl)).toEqual({ status: 'ok' });
    expect(f.calls).toEqual(['HEAD https://cdn.tafsir.net/a.mp4', 'GET https://cdn.tafsir.net/a.mp4']);
  });

  it('treats 404 as broken but server errors and network failures as unknown', async () => {
    expect(await checkMediaUrl('https://cdn.tafsir.net/a.png', fakeFetch(() => 404).impl)).toEqual({
      status: 'broken',
      error: 'HTTP 404',
    });
    expect((await checkMediaUrl('https://cdn.tafsir.net/a.png', fakeFetch(() => 503).impl)).status).toBe('unknown');
    expect((await checkMediaUrl('https://cdn.tafsir.net/a.png', fakeFetch(() => new Error('timeout')).impl)).status).toBe(
      'unknown',
    );
  });
});

describe('runLinkCheck', () => {
  it('records decisive results only and counts suspensions', async () => {
    const recorded: string[] = [];
    const media = [
      { id: 'm1', url: 'https://cdn.tafsir.net/ok.png' },
      { id: 'm2', url: 'https://cdn.tafsir.net/gone.png' },
      { id: 'm3', url: 'https://cdn.tafsir.net/flaky.png' },
    ];
    const f = fakeFetch((url) => (url.includes('ok') ? 200 : url.includes('gone') ? 404 : 503));
    const summary = await runLinkCheck(
      media,
      async (id, ok, error) => {
        recorded.push(`${id}:${ok}:${error}`);
        return !ok;
      },
      f.impl,
    );
    expect(recorded.sort()).toEqual(['m1:true:null', 'm2:false:HTTP 404']);
    expect(summary).toEqual({ checked: 3, ok: 1, broken: 1, unknown: 1, suspended: 1, failures: [] });
  });

  it('keeps going when recording one result fails', async () => {
    const summary = await runLinkCheck(
      [{ id: 'm1', url: 'https://cdn.tafsir.net/a.png' }],
      async () => {
        throw new Error('db down');
      },
      fakeFetch(() => 200).impl,
    );
    expect(summary.failures).toEqual(['m1: db down']);
  });
});
