import 'package:material_ui/material_ui.dart';

import 'data/game_api.dart';
import 'ui/start_screen.dart';

class QuizApp extends StatelessWidget {
  const QuizApp({super.key, required this.api});
  final GameApi api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'المسابقة القرآنية',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E))),
      home: StartScreen(api: api),
    );
  }
}
