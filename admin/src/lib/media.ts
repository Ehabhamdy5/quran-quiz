export type MediaKind = 'image' | 'video';
export type Placement = 'question' | 'answer';

export type MediaInput = {
  url: string;
  kind: MediaKind;
  startSeconds: number | null;
  endSeconds: number | null;
  altText: string;
};

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];

export function parseYouTubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.includes(host)) return null;

  let id: string | null;
  if (host === 'youtu.be') {
    id = u.pathname.slice(1).split('/')[0] || null;
  } else if (u.pathname === '/watch') {
    id = u.searchParams.get('v');
  } else {
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
    id = m ? m[2] : null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function isAllowedDomain(raw: string, allowed: string[]): boolean {
  let host: string;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowed.some((d) => {
    const domain = d.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  });
}

export function validateMedia(m: MediaInput, allowed: string[]): string[] {
  const errors: string[] = [];
  if (!isAllowedDomain(m.url, allowed)) {
    errors.push('الرابط ليس من المواقع المسموح بها أو لا يبدأ بـ https');
  }
  if (!m.altText.trim()) errors.push('الوصف النصي البديل مطلوب');
  if (m.kind === 'image' && (m.startSeconds !== null || m.endSeconds !== null)) {
    errors.push('وقت البداية والنهاية للفيديو فقط');
  }
  if (m.startSeconds !== null && m.startSeconds < 0) errors.push('وقت البداية لا يكون سالبًا');
  if (m.startSeconds !== null && m.endSeconds !== null && m.endSeconds <= m.startSeconds) {
    errors.push('وقت النهاية يجب أن يكون بعد وقت البداية');
  }
  return errors;
}

export function youTubeEmbedUrl(id: string, start?: number | null, end?: number | null): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
  if (start != null) params.set('start', String(start));
  if (end != null) params.set('end', String(end));
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function readMediaFields(fd: FormData, placement: Placement): MediaInput | null {
  const get = (key: string) => String(fd.get(`${placement}_media_${key}`) ?? '').trim();
  const url = get('url');
  if (!url) return null;
  const num = (key: string) => (get(key) === '' ? null : Number(get(key)));
  return {
    url,
    kind: get('kind') === 'image' ? 'image' : 'video',
    startSeconds: num('start'),
    endSeconds: num('end'),
    altText: get('alt'),
  };
}
