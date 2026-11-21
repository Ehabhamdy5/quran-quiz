import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../data/game_api.dart';
import '../data/models.dart';
import 'media_view.dart';
import 'question_view.dart';
import 'report_dialog.dart';
import 'summary_screen.dart';

/// جولة كاملة: سؤال بعدّاد، ثم كشف الإجابة والفائدة، حتى الملخص.
class RoundScreen extends StatefulWidget {
  const RoundScreen({super.key, required this.api, required this.categoryId});
  final GameApi api;
  final int? categoryId;

  @override
  State<RoundScreen> createState() => _RoundScreenState();
}

class _RoundScreenState extends State<RoundScreen> {
  RoundStart? _round;
  ShownQuestion? _question;
  AnswerResult? _result;
  String? _error;
  bool _sending = false;
  int _position = 1;
  double _remaining = 0;
  double _delay = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _guard(Future<void> Function() f) async {
    try {
      await f();
    } on GameException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _start() => _guard(() async {
        final round = await widget.api.startRound(widget.categoryId);
        setState(() => _round = round);
        await _show();
      });

  Future<void> _show() => _guard(() async {
        final q = await widget.api.showQuestion(_round!.roundId, _position);
        setState(() {
          _question = q;
          _result = null;
          _delay = q.timerDelay.toDouble();
          _remaining = q.timeLimit.toDouble();
        });
        _timer?.cancel();
        _timer = Timer.periodic(const Duration(milliseconds: 100), (_) => _tick());
      });

  void _tick() {
    if (!mounted || _result != null || _sending) return;
    setState(() {
      if (_delay > 0) {
        _delay = (_delay - 0.1).clamp(0, double.infinity);
      } else {
        _remaining = (_remaining - 0.1).clamp(0, double.infinity);
      }
    });
    if (_delay == 0 && _remaining == 0) _submit(null);
  }

  Future<void> _submit(Object? answer) async {
    if (_sending || _result != null) return;
    _timer?.cancel();
    setState(() => _sending = true);
    await _guard(() async {
      final r = await widget.api.answer(_round!.roundId, _position, answer);
      setState(() => _result = r);
    });
    if (mounted) setState(() => _sending = false);
  }

  Future<void> _next() async {
    if (_result!.isLast) {
      await _guard(() async {
        final summary = await widget.api.finishRound(_round!.roundId);
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => SummaryScreen(summary: summary)),
        );
      });
    } else {
      _position++;
      await _show();
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _question;
    return Scaffold(
      appBar: AppBar(
        title: Text(q == null ? 'جولة جديدة' : 'السؤال ${q.position} من ${q.questionCount}'),
        actions: [
          if (q != null)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 16),
              child: Center(child: Text('${_result?.score ?? q.score} نقطة')),
            ),
        ],
      ),
      body: SafeArea(
        child: _error != null
            ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
            : q == null
                ? const Center(child: CircularProgressIndicator())
                : ListView(padding: const EdgeInsets.all(16), children: [
                    if (_result == null) ..._questionPart(q) else ..._revealPart(q, _result!),
                  ]),
      ),
    );
  }

  List<Widget> _questionPart(ShownQuestion q) => [
        if (_delay > 0)
          Text('شاهد اللقطة، ثم يبدأ العدّاد', style: Theme.of(context).textTheme.bodySmall)
        else
          LinearProgressIndicator(value: _remaining / q.timeLimit, minHeight: 6),
        const SizedBox(height: 4),
        if (_delay == 0) Text('${_remaining.ceil()} ثانية', textAlign: TextAlign.end),
        const SizedBox(height: 12),
        Text(q.prompt, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 16),
        if (q.media != null) ...[MediaView(q.media!, key: ValueKey('q-${q.questionId}')), const SizedBox(height: 16)],
        AnswerInput(
          key: ValueKey(q.questionId),
          type: q.type,
          options: q.options,
          enabled: !_sending,
          onAnswer: _submit,
        ),
      ];

  List<Widget> _revealPart(ShownQuestion q, AnswerResult r) {
    final theme = Theme.of(context);
    final verdict = r.isCorrect
        ? 'إجابة صحيحة: ${r.points} نقطة'
        : r.timedOut
            ? 'انتهى الوقت'
            : 'إجابة غير صحيحة';
    return [
      Card(
        color: r.isCorrect ? Colors.green.shade50 : Colors.orange.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(verdict, style: theme.textTheme.titleMedium),
            if (r.isCorrect && r.streak >= 3) Text('تتابع ${r.streak} إجابات صحيحة', style: theme.textTheme.bodySmall),
            const SizedBox(height: 8),
            Text('الإجابة الصحيحة:', style: theme.textTheme.labelLarge),
            Text(r.correctText(q.type), style: theme.textTheme.bodyLarge),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      Text('فائدة', style: theme.textTheme.titleSmall),
      Text(r.benefit, style: theme.textTheme.bodyLarge),
      const SizedBox(height: 4),
      Text('المصدر: ${r.sourceText}', style: theme.textTheme.bodySmall),
      if (r.media != null) ...[
        const SizedBox(height: 16),
        Text('شرح مرئي (يمكن تخطيه)', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        MediaView(r.media!, key: ValueKey('a-${q.questionId}')),
      ],
      const SizedBox(height: 20),
      FilledButton(onPressed: _next, child: Text(r.isLast ? 'عرض النتيجة' : 'السؤال التالي')),
      TextButton(
        onPressed: () => showReportDialog(context, widget.api, q.questionId),
        child: const Text('إبلاغ عن خطأ في هذا السؤال'),
      ),
    ];
  }
}
