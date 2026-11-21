import 'package:material_ui/material_ui.dart';

/// أزرار الإجابة حسب نوع السؤال. [onAnswer] يُستدعى مرة واحدة بالإجابة بصيغة الخادم.
class AnswerInput extends StatefulWidget {
  const AnswerInput({super.key, required this.type, required this.options, required this.enabled, required this.onAnswer});
  final String type;
  final List<String>? options;
  final bool enabled;
  final ValueChanged<Object> onAnswer;

  @override
  State<AnswerInput> createState() => _AnswerInputState();
}

class _AnswerInputState extends State<AnswerInput> {
  late final List<String> _order = [...?widget.options];

  @override
  Widget build(BuildContext context) {
    final onAnswer = widget.enabled ? widget.onAnswer : null;
    switch (widget.type) {
      case 'true_false':
        return Row(children: [
          Expanded(child: _choice('صواب', onAnswer == null ? null : () => onAnswer(true))),
          const SizedBox(width: 12),
          Expanded(child: _choice('خطأ', onAnswer == null ? null : () => onAnswer(false))),
        ]);
      case 'ordering':
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('اسحب العناصر لترتيبها من الأول إلى الأخير', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 8),
          ReorderableListView(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: widget.enabled,
            onReorderItem: (from, to) => setState(() => _order.insert(to, _order.removeAt(from))),
            children: [
              for (var i = 0; i < _order.length; i++)
                Card(
                  key: ValueKey(_order[i]),
                  child: ListTile(leading: CircleAvatar(child: Text('${i + 1}')), title: Text(_order[i])),
                ),
            ],
          ),
          const SizedBox(height: 8),
          FilledButton(onPressed: onAnswer == null ? null : () => onAnswer(List<String>.of(_order)), child: const Text('تأكيد الترتيب')),
        ]);
      default: // mcq و visual
        final o = widget.options ?? const [];
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var i = 0; i < o.length; i++) ...[
            _choice(o[i], onAnswer == null ? null : () => onAnswer(i)),
            const SizedBox(height: 8),
          ],
        ]);
    }
  }

  Widget _choice(String label, VoidCallback? onTap) => OutlinedButton(
        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12), alignment: Alignment.centerRight),
        onPressed: onTap,
        child: Text(label, style: const TextStyle(fontSize: 16)),
      );
}
