import { parseYouTubeId } from './media';

export type CheckResult = { status: 'ok' } | { status: 'broken' | 'unknown'; error: string };

export type CheckSummary = {
  checked: number;
  ok: number;
  broken: number;
  unknown: number;
  suspended: number;
  failures: string[];
};

const TIMEOUT_MS = 15_000;

function request(fetchImpl: typeof fetch, url: string, method: 'HEAD' | 'GET', range = false) {
  return fetchImpl(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: range ? { Range: 'bytes=0-0' } : undefined,
  });
}

export async function checkMediaUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<CheckResult> {
  try {
    const id = parseYouTubeId(url);
    if (id) {
      const watch = `https://www.youtube.com/watch?v=${id}`;
      const res = await request(fetchImpl, `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, 'GET');
      if (res.ok) return { status: 'ok' };
      if (res.status === 401 || res.status === 403) return { status: 'broken', error: 'الفيديو خاص أو يمنع التضمين' };
      if (res.status === 400 || res.status === 404) return { status: 'broken', error: 'الفيديو غير موجود على يوتيوب' };
      return { status: 'unknown', error: `HTTP ${res.status}` };
    }

    let res = await request(fetchImpl, url, 'HEAD');
    if (res.status === 405 || res.status === 501) res = await request(fetchImpl, url, 'GET', true);
    if (res.ok) return { status: 'ok' };
    if ([401, 403, 404, 410].includes(res.status)) return { status: 'broken', error: `HTTP ${res.status}` };
    return { status: 'unknown', error: `HTTP ${res.status}` };
  } catch (e) {
    return { status: 'unknown', error: e instanceof Error ? e.message : String(e) };
  }
}

// record يُرجع true إذا أُوقف سؤال بسبب النتيجة.
export async function runLinkCheck(
  media: { id: string; url: string }[],
  record: (id: string, ok: boolean, error: string | null) => Promise<boolean>,
  fetchImpl: typeof fetch = fetch,
  concurrency = 4,
): Promise<CheckSummary> {
  const summary: CheckSummary = { checked: 0, ok: 0, broken: 0, unknown: 0, suspended: 0, failures: [] };
  const queue = [...media];

  async function worker() {
    for (let m = queue.shift(); m; m = queue.shift()) {
      const result = await checkMediaUrl(m.url, fetchImpl);
      summary.checked++;
      summary[result.status]++;
      if (result.status === 'unknown') continue;
      try {
        const ok = result.status === 'ok';
        if (await record(m.id, ok, ok ? null : result.error)) summary.suspended++;
      } catch (e) {
        summary.failures.push(`${m.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, media.length) }, worker));
  return summary;
}
