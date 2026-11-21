import 'package:quran_quiz/data/game_api.dart';
import 'package:quran_quiz/data/models.dart';

/// خادم وهمي بقواعد مبسطة: الإجابة الصحيحة للاختيار هي الخيار الأول، وللترتيب ترتيبه الأصلي.
class FakeGameApi implements GameApi {
  FakeGameApi({this.player, List<ShownQuestion>? questions, this.promoteTo}) : questions = questions ?? defaultQuestions;

  Player? player;
  final List<ShownQuestion> questions;
  final String? promoteTo;
  final answers = <Object?>[];
  final reports = <String>[];
  int score = 0;
  int correct = 0;

  static final defaultQuestions = [
    _q(1, 'mcq', 'ما معنى الصمد؟', ['السيد الذي تصمد إليه الخلائق', 'الخالق', 'الرزاق', 'القريب']),
    _q(2, 'true_false', 'نفت الآية أن يكون لله ولد أو والد.', null),
    _q(3, 'ordering', 'رتّب الأحداث', ['الأول', 'الثاني', 'الثالث']),
  ];

  static ShownQuestion _q(int pos, String type, String prompt, List<String>? options) => ShownQuestion(
        position: pos,
        questionCount: 3,
        questionId: 'q$pos',
        type: type,
        prompt: prompt,
        options: options,
        media: null,
        timeLimit: 20,
        timerDelay: 0,
        score: 0,
      );

  @override
  Future<void> ensureSession() async {}

  @override
  Future<Player?> currentPlayer() async => player;

  @override
  Future<Player> register(String name) async {
    if (name.trim().length < 2) throw GameException('الاسم من حرفين إلى 24 حرفًا');
    return player = Player(name: name.trim(), level: 'beginner');
  }

  @override
  Future<RoundStart> startRound(int? categoryId) async =>
      RoundStart(roundId: 'r1', questionCount: questions.length, timeLimit: 20);

  @override
  Future<ShownQuestion> showQuestion(String roundId, int position) async => questions[position - 1];

  @override
  Future<AnswerResult> answer(String roundId, int position, Object? answer) async {
    answers.add(answer);
    final q = questions[position - 1];
    final ok = switch (q.type) {
      'true_false' => answer == true,
      'ordering' => answer is List && answer.join('|') == q.options!.join('|'),
      _ => answer == 0,
    };
    final pts = ok ? 15 : 0;
    score += pts;
    if (ok) correct++;
    return AnswerResult(
      isCorrect: ok,
      timedOut: answer == null,
      points: pts,
      streak: ok ? correct : 0,
      score: score,
      correctAnswer: q.type == 'true_false' ? true : (q.type == 'ordering' ? null : 0),
      options: q.options,
      benefit: 'فائدة السؤال $position',
      sourceBook: 'تفسير السعدي',
      sourcePage: 'تفسير الآية 112:$position',
      isLast: position == questions.length,
    );
  }

  @override
  Future<RoundSummary> finishRound(String roundId) async =>
      RoundSummary(score: score, correct: correct, total: questions.length, promotedTo: promoteTo);

  @override
  Future<List<LeaderboardEntry>> leaderboard({required String kind, int? categoryId}) async => [
        const LeaderboardEntry(rank: 1, name: 'عبد الله', points: 300, isMe: false),
        LeaderboardEntry(rank: 2, name: kind == 'weekly' ? 'أنا' : 'أنا دائمًا', points: 120, isMe: true),
      ];

  @override
  Future<void> report(String questionId, String reason) async => reports.add('$questionId: $reason');
}
