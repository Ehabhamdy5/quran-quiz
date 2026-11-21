import 'package:material_ui/material_ui.dart';

import '../data/game_api.dart';
import '../data/models.dart';
import 'home_screen.dart';

/// أول تشغيل: دخول مجهول، ثم اختيار اسم يظهر في لوحات المتصدرين.
class StartScreen extends StatefulWidget {
  const StartScreen({super.key, required this.api});
  final GameApi api;

  @override
  State<StartScreen> createState() => _StartScreenState();
}

class _StartScreenState extends State<StartScreen> {
  final _name = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    try {
      await widget.api.ensureSession();
      final p = await widget.api.currentPlayer();
      if (p != null) return _goHome(p);
    } on GameException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _loading = false);
  }

  void _goHome(Player p) {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => HomeScreen(api: widget.api, player: p)));
  }

  Future<void> _register() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      _goHome(await widget.api.register(_name.text));
    } on GameException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: _loading
              ? const CircularProgressIndicator()
              : ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text('المسابقة القرآنية', style: theme.textTheme.headlineMedium, textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      Text('أسئلة في التفسير ومعاني الكلمات وقصص القرآن، يراجعها الفريق العلمي لمركز تفسير.',
                          style: theme.textTheme.bodyMedium, textAlign: TextAlign.center),
                      const SizedBox(height: 24),
                      TextField(
                        controller: _name,
                        maxLength: 24,
                        decoration: const InputDecoration(labelText: 'اسمك في لوحة المتصدرين', border: OutlineInputBorder()),
                        onSubmitted: (_) => _register(),
                      ),
                      if (_error != null) Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                      const SizedBox(height: 12),
                      FilledButton(onPressed: _saving ? null : _register, child: const Text('ابدأ')),
                    ]),
                  ),
                ),
        ),
      ),
    );
  }
}
