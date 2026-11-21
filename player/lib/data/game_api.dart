import 'models.dart';

/// كل ما يحتاجه التطبيق من الخادم. التصحيح والوقت والنقاط تُحسب هناك.
abstract class GameApi {
  /// يضمن جلسة (دخول مجهول عند أول تشغيل).
  Future<void> ensureSession();
  Future<Player?> currentPlayer();
  Future<Player> register(String name);
  Future<RoundStart> startRound(int? categoryId);
  Future<ShownQuestion> showQuestion(String roundId, int position);

  /// [answer]: رقم الخيار، أو true/false، أو قائمة العناصر بترتيب اللاعب، أو null عند انتهاء الوقت.
  Future<AnswerResult> answer(String roundId, int position, Object? answer);
  Future<RoundSummary> finishRound(String roundId);
  Future<List<LeaderboardEntry>> leaderboard({required String kind, int? categoryId});
  Future<void> report(String questionId, String reason);
}
