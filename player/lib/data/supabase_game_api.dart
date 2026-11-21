import 'package:supabase_flutter/supabase_flutter.dart';

import 'game_api.dart';
import 'models.dart';

class SupabaseGameApi implements GameApi {
  SupabaseGameApi(this.client);
  final SupabaseClient client;

  Future<T> _call<T>(Future<T> Function() f) async {
    try {
      return await f();
    } on PostgrestException catch (e) {
      throw GameException(e.message);
    } on AuthException catch (e) {
      throw GameException(e.message);
    }
  }

  Future<Map<String, dynamic>> _rpc(String fn, Map<String, dynamic> params) => _call(() async {
        final r = await client.rpc(fn, params: params);
        return (r as Map).cast<String, dynamic>();
      });

  @override
  Future<void> ensureSession() => _call(() async {
        if (client.auth.currentSession == null) await client.auth.signInAnonymously();
      });

  @override
  Future<Player?> currentPlayer() => _call(() async {
        final row = await client.from('players').select('display_name, level').maybeSingle();
        return row == null ? null : Player.fromJson(row);
      });

  @override
  Future<Player> register(String name) async => Player.fromJson(await _rpc('register_player', {'name': name}));

  @override
  Future<RoundStart> startRound(int? categoryId) async =>
      RoundStart.fromJson(await _rpc('start_round', {'p_category': categoryId}));

  @override
  Future<ShownQuestion> showQuestion(String roundId, int position) async =>
      ShownQuestion.fromJson(await _rpc('show_question', {'p_round': roundId, 'p_position': position}));

  @override
  Future<AnswerResult> answer(String roundId, int position, Object? answer) async => AnswerResult.fromJson(
      await _rpc('answer_question', {'p_round': roundId, 'p_position': position, 'p_answer': answer}));

  @override
  Future<RoundSummary> finishRound(String roundId) async =>
      RoundSummary.fromJson(await _rpc('finish_round', {'p_round': roundId}));

  @override
  Future<List<LeaderboardEntry>> leaderboard({required String kind, int? categoryId}) => _call(() async {
        final rows = await client.rpc('leaderboard', params: {'p_kind': kind, 'p_category': categoryId}) as List;
        return rows.map((r) => LeaderboardEntry.fromJson((r as Map).cast<String, dynamic>())).toList();
      });

  @override
  Future<void> report(String questionId, String reason) =>
      _call(() => client.rpc('report_question', params: {'p_question': questionId, 'p_reason': reason}));
}
