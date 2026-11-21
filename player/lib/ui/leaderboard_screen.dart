import 'package:material_ui/material_ui.dart';

import '../data/game_api.dart';
import '../data/models.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key, required this.api});
  final GameApi api;

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  String _kind = 'weekly';
  int? _category;
  late Future<List<LeaderboardEntry>> _entries = _load();

  Future<List<LeaderboardEntry>> _load() => widget.api.leaderboard(kind: _kind, categoryId: _category);

  void _change({String? kind, int? category, bool clearCategory = false}) => setState(() {
        _kind = kind ?? _kind;
        _category = clearCategory ? null : (category ?? _category);
        _entries = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('لوحة المتصدرين')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'weekly', label: Text('هذا الأسبوع')),
              ButtonSegment(value: 'all_time', label: Text('كل الأوقات')),
            ],
            selected: {_kind},
            onSelectionChanged: (s) => _change(kind: s.first),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: [
            ChoiceChip(label: const Text('الكل'), selected: _category == null, onSelected: (_) => _change(clearCategory: true)),
            for (final c in categoryNames.entries) ...[
              const SizedBox(width: 8),
              ChoiceChip(label: Text(c.value), selected: _category == c.key, onSelected: (_) => _change(category: c.key)),
            ],
          ]),
        ),
        if (_kind == 'weekly')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('تبدأ لوحة الأسبوع من جديد كل جمعة', style: Theme.of(context).textTheme.bodySmall),
          ),
        Expanded(
          child: FutureBuilder<List<LeaderboardEntry>>(
            future: _entries,
            builder: (context, snap) {
              if (snap.hasError) return Center(child: Text('${snap.error}'));
              if (!snap.hasData) return const Center(child: CircularProgressIndicator());
              final rows = snap.data!;
              if (rows.isEmpty) return const Center(child: Text('لا نتائج بعد. كن أول من يلعب!'));
              return ListView(children: [
                for (final e in rows)
                  ListTile(
                    selected: e.isMe,
                    leading: CircleAvatar(child: Text('${e.rank}')),
                    title: Text(e.isMe ? '${e.name} (أنت)' : e.name),
                    trailing: Text('${e.points}'),
                  ),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}
