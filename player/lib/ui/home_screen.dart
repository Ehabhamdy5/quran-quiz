import 'package:material_ui/material_ui.dart';

import '../data/game_api.dart';
import '../data/models.dart';
import 'leaderboard_screen.dart';
import 'round_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api, required this.player});
  final GameApi api;
  final Player player;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Player _player = widget.player;

  Future<void> _play(int? category) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => RoundScreen(api: widget.api, categoryId: category)));
    // قد يكون اللاعب ترقّى في الجولة.
    final p = await widget.api.currentPlayer();
    if (p != null && mounted) setState(() => _player = p);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('المسابقة القرآنية'),
        actions: [
          IconButton(
            tooltip: 'لوحة المتصدرين',
            icon: const Icon(Icons.leaderboard),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => LeaderboardScreen(api: widget.api))),
          ),
        ],
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text('أهلًا ${_player.name}', style: theme.textTheme.headlineSmall),
        Text('مستواك: ${levelNames[_player.level] ?? _player.level}', style: theme.textTheme.bodyMedium),
        const SizedBox(height: 8),
        Text('الجولة عشرة أسئلة، لكل سؤال عشرون ثانية، ولا خصم على الخطأ.', style: theme.textTheme.bodySmall),
        const SizedBox(height: 24),
        FilledButton.icon(
          style: FilledButton.styleFrom(padding: const EdgeInsets.all(18)),
          onPressed: () => _play(null),
          icon: const Icon(Icons.shuffle),
          label: const Text('جولة منوّعة', style: TextStyle(fontSize: 18)),
        ),
        const SizedBox(height: 16),
        Text('أو اختر تصنيفًا', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        for (final c in categoryNames.entries)
          Card(
            child: ListTile(
              title: Text(c.value),
              trailing: const Icon(Icons.chevron_left),
              onTap: () => _play(c.key),
            ),
          ),
      ]),
    );
  }
}
