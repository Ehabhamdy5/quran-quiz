import 'package:material_ui/material_ui.dart';

import '../data/game_api.dart';
import '../data/models.dart';

Future<void> showReportDialog(BuildContext context, GameApi api, String questionId) async {
  final controller = TextEditingController();
  final messenger = ScaffoldMessenger.of(context);
  final sent = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('إبلاغ عن خطأ'),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 500,
        maxLines: 3,
        decoration: const InputDecoration(hintText: 'ما الخطأ في السؤال أو إجابته؟'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('إرسال')),
      ],
    ),
  );
  if (sent != true) return;
  try {
    await api.report(questionId, controller.text);
    messenger.showSnackBar(const SnackBar(content: Text('وصل البلاغ، جزاك الله خيرًا. سيراجعه الفريق العلمي.')));
  } on GameException catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(e.message)));
  }
}
