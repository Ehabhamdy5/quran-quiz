import { parseYouTubeId, youTubeEmbedUrl, type MediaKind } from '@/lib/media';

export function MediaPreview({
  kind,
  url,
  start,
  end,
  alt,
}: {
  kind: MediaKind;
  url: string;
  start: number | null;
  end: number | null;
  alt: string;
}) {
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className="max-h-80 rounded border" />;
  }
  const id = parseYouTubeId(url);
  if (id) {
    return (
      <iframe
        src={youTubeEmbedUrl(id, start, end)}
        title={alt}
        allow="encrypted-media"
        allowFullScreen
        className="aspect-video w-full max-w-xl rounded border"
      />
    );
  }
  return <video src={url} controls aria-label={alt} className="w-full max-w-xl rounded border" />;
}
