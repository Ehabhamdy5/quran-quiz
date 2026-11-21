import 'package:material_ui/material_ui.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../data/models.dart';

String? youTubeId(String url) {
  final u = Uri.tryParse(url);
  if (u == null) return null;
  final host = u.host.toLowerCase();
  String? id;
  if (host == 'youtu.be') {
    id = u.pathSegments.isNotEmpty ? u.pathSegments.first : null;
  } else if (host.endsWith('youtube.com')) {
    id = u.path == '/watch'
        ? u.queryParameters['v']
        : (u.pathSegments.length >= 2 && ['shorts', 'embed', 'live'].contains(u.pathSegments.first) ? u.pathSegments[1] : null);
  }
  return id != null && RegExp(r'^[A-Za-z0-9_-]{11}$').hasMatch(id) ? id : null;
}

/// الوصف النصي البديل: يظهر إن تعذّر تحميل الوسيط، فتستمر الجولة.
class AltText extends StatelessWidget {
  const AltText(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
      );
}

class MediaView extends StatefulWidget {
  const MediaView(this.media, {super.key});
  final Media media;

  @override
  State<MediaView> createState() => _MediaViewState();
}

class _MediaViewState extends State<MediaView> {
  YoutubePlayerController? _yt;

  @override
  void initState() {
    super.initState();
    final m = widget.media;
    final id = m.kind == 'video' ? youTubeId(m.url) : null;
    if (id != null) {
      _yt = YoutubePlayerController.fromVideoId(
        videoId: id,
        autoPlay: true,
        startSeconds: m.start?.toDouble(),
        endSeconds: m.end?.toDouble(),
        params: const YoutubePlayerParams(showFullscreenButton: false, strictRelatedVideos: true, interfaceLanguage: 'ar'),
      );
    }
  }

  @override
  void dispose() {
    _yt?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.media;
    if (m.kind == 'image') {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          m.url,
          semanticLabel: m.alt,
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) => AltText(m.alt),
        ),
      );
    }
    if (_yt != null) return YoutubePlayer(controller: _yt!);
    // روابط الفيديو المباشرة تُعرض في إصدار لاحق؛ إلى ذلك الحين يظهر الوصف.
    return AltText(m.alt);
  }
}
