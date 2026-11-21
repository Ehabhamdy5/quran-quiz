// نماذج بيانات اللعب كما تعيدها دوال الخادم.

const categoryNames = <int, String>{
  1: 'التفسير',
  2: 'معاني الكلمات',
  3: 'قصص القرآن',
  4: 'قصص الأنبياء',
};

const levelNames = <String, String>{
  'beginner': 'مبتدئ',
  'intermediate': 'متوسط',
  'advanced': 'متقدم',
};

class GameException implements Exception {
  GameException(this.message);
  final String message;
  @override
  String toString() => message;
}

class Player {
  const Player({required this.name, required this.level});
  final String name;
  final String level;

  factory Player.fromJson(Map<String, dynamic> j) =>
      Player(name: j['display_name'] as String, level: j['level'] as String);
}

class RoundStart {
  const RoundStart({required this.roundId, required this.questionCount, required this.timeLimit});
  final String roundId;
  final int questionCount;
  final int timeLimit;

  factory RoundStart.fromJson(Map<String, dynamic> j) => RoundStart(
        roundId: j['round_id'] as String,
        questionCount: (j['question_count'] as num).toInt(),
        timeLimit: (j['time_limit'] as num).toInt(),
      );
}

class Media {
  const Media({required this.kind, required this.url, this.start, this.end, required this.alt});
  final String kind; // image | video
  final String url;
  final int? start;
  final int? end;
  final String alt;

  static Media? fromJson(Object? j) {
    if (j is! Map<String, dynamic>) return null;
    return Media(
      kind: j['kind'] as String,
      url: j['url'] as String,
      start: (j['start'] as num?)?.toInt(),
      end: (j['end'] as num?)?.toInt(),
      alt: j['alt'] as String,
    );
  }
}

List<String>? _strings(Object? j) => j is List ? j.map((e) => e.toString()).toList() : null;

class ShownQuestion {
  const ShownQuestion({
    required this.position,
    required this.questionCount,
    required this.questionId,
    required this.type,
    required this.prompt,
    required this.options,
    required this.media,
    required this.timeLimit,
    required this.timerDelay,
    required this.score,
  });
  final int position;
  final int questionCount;
  final String questionId;
  final String type; // mcq | true_false | visual | ordering
  final String prompt;
  final List<String>? options;
  final Media? media;
  final int timeLimit;
  final int timerDelay;
  final int score;

  factory ShownQuestion.fromJson(Map<String, dynamic> j) => ShownQuestion(
        position: (j['position'] as num).toInt(),
        questionCount: (j['question_count'] as num).toInt(),
        questionId: j['question_id'] as String,
        type: j['type'] as String,
        prompt: j['prompt'] as String,
        options: _strings(j['options']),
        media: Media.fromJson(j['media']),
        timeLimit: (j['time_limit'] as num).toInt(),
        timerDelay: (j['timer_delay'] as num? ?? 0).toInt(),
        score: (j['score'] as num? ?? 0).toInt(),
      );
}

class AnswerResult {
  const AnswerResult({
    required this.isCorrect,
    required this.timedOut,
    required this.points,
    required this.streak,
    required this.score,
    required this.correctAnswer,
    required this.options,
    required this.benefit,
    required this.sourceBook,
    this.sourceVolume,
    required this.sourcePage,
    this.media,
    required this.isLast,
  });
  final bool isCorrect;
  final bool timedOut;
  final int points;
  final int streak;
  final int score;
  final Object? correctAnswer;
  final List<String>? options;
  final String benefit;
  final String sourceBook;
  final String? sourceVolume;
  final String sourcePage;
  final Media? media;
  final bool isLast;

  factory AnswerResult.fromJson(Map<String, dynamic> j) {
    final source = (j['source'] as Map).cast<String, dynamic>();
    return AnswerResult(
      isCorrect: j['is_correct'] as bool,
      timedOut: j['timed_out'] as bool,
      points: (j['points'] as num).toInt(),
      streak: (j['streak'] as num? ?? 0).toInt(),
      score: (j['score'] as num).toInt(),
      correctAnswer: j['correct_answer'],
      options: _strings(j['options']),
      benefit: j['benefit'] as String,
      sourceBook: source['book'] as String,
      sourceVolume: source['volume'] as String?,
      sourcePage: source['page'] as String,
      media: Media.fromJson(j['media']),
      isLast: j['is_last'] as bool,
    );
  }

  /// نص الإجابة الصحيحة كما يُعرض للاعب.
  String correctText(String type) {
    if (type == 'true_false') return correctAnswer == true ? 'صواب' : 'خطأ';
    if (type == 'ordering') {
      final o = options ?? const [];
      return [for (var i = 0; i < o.length; i++) '${i + 1}. ${o[i]}'].join('\n');
    }
    final i = (correctAnswer as num?)?.toInt();
    return i != null && options != null && i < options!.length ? options![i] : '';
  }

  String get sourceText =>
      [sourceBook, if (sourceVolume != null && sourceVolume!.isNotEmpty) 'الجزء $sourceVolume', sourcePage].join('، ');
}

class RoundSummary {
  const RoundSummary({required this.score, required this.correct, required this.total, this.promotedTo});
  final int score;
  final int correct;
  final int total;
  final String? promotedTo;

  factory RoundSummary.fromJson(Map<String, dynamic> j) => RoundSummary(
        score: (j['score'] as num).toInt(),
        correct: (j['correct'] as num).toInt(),
        total: (j['total'] as num).toInt(),
        promotedTo: j['promoted_to'] as String?,
      );
}

class LeaderboardEntry {
  const LeaderboardEntry({required this.rank, required this.name, required this.points, required this.isMe});
  final int rank;
  final String name;
  final int points;
  final bool isMe;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> j) => LeaderboardEntry(
        rank: (j['rank'] as num).toInt(),
        name: j['display_name'] as String,
        points: (j['points'] as num).toInt(),
        isMe: j['is_me'] as bool,
      );
}
