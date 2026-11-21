// يختبر طبقة الاتصال الحقيقية على Supabase محلي فيه أسئلة منشورة للمبتدئ:
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_PUBLISHABLE_KEY=... flutter test test/integration
@Tags(['integration'])
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:quran_quiz/data/models.dart';
import 'package:quran_quiz/data/supabase_game_api.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  final url = Platform.environment['SUPABASE_URL'];
  final key = Platform.environment['SUPABASE_PUBLISHABLE_KEY'];
  final skip = url == null || key == null ? 'اضبط SUPABASE_URL و SUPABASE_PUBLISHABLE_KEY' : false;

  SupabaseGameApi newPlayer() => SupabaseGameApi(SupabaseClient(url!, key!, authOptions: const AuthClientOptions(autoRefreshToken: false)));

  test('a new anonymous player plays a full round against the real server', () async {
    final api = newPlayer();
    await api.ensureSession();
    expect(await api.currentPlayer(), isNull);
    await expectLater(api.startRound(null), throwsA(isA<GameException>().having((e) => e.message, 'message', 'سجّل اسمك للبدء')));

    final player = await api.register('لاعب التكامل');
    expect(player.level, 'beginner');

    final round = await api.startRound(null);
    expect(round.questionCount, inInclusiveRange(1, 10));
    expect(round.timeLimit, 20);

    var lastScore = 0;
    String? firstQuestion;
    for (var pos = 1; pos <= round.questionCount; pos++) {
      final q = await api.showQuestion(round.roundId, pos);
      firstQuestion ??= q.questionId;
      expect(q.position, pos);
      expect(q.prompt, isNotEmpty);
      final Object answer = switch (q.type) {
        'true_false' => true,
        'ordering' => q.options!,
        _ => 0,
      };
      final r = await api.answer(round.roundId, pos, answer);
      expect(r.benefit, isNotEmpty);
      expect(r.sourceBook, isNotEmpty);
      expect(r.correctText(q.type), isNotEmpty);
      expect(r.score, greaterThanOrEqualTo(lastScore));
      expect(r.isLast, pos == round.questionCount);
      lastScore = r.score;
    }
    await expectLater(api.answer(round.roundId, 1, 0),
        throwsA(isA<GameException>().having((e) => e.message, 'message', 'أُجيب عن هذا السؤال من قبل')));

    final summary = await api.finishRound(round.roundId);
    expect(summary.score, lastScore);
    expect(summary.total, round.questionCount);

    final board = await api.leaderboard(kind: 'weekly');
    if (lastScore > 0) expect(board.where((e) => e.isMe).single.name, 'لاعب التكامل');

    await api.report(firstQuestion!, 'اختبار البلاغ من التطبيق');
  }, skip: skip);
}
