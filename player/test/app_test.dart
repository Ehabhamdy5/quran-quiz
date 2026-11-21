import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:quran_quiz/app.dart';
import 'package:quran_quiz/data/models.dart';
import 'package:quran_quiz/ui/leaderboard_screen.dart';
import 'package:quran_quiz/ui/round_screen.dart';

import 'fake_api.dart';

Widget wrap(Widget child) => MaterialApp(locale: const Locale('ar'), home: child);

void main() {
  testWidgets('a new player picks a name and reaches the home screen', (tester) async {
    final api = FakeGameApi();
    await tester.pumpWidget(QuizApp(api: api));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'ا');
    await tester.tap(find.text('ابدأ'));
    await tester.pumpAndSettle();
    expect(find.text('الاسم من حرفين إلى 24 حرفًا'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'أحمد');
    await tester.tap(find.text('ابدأ'));
    await tester.pumpAndSettle();
    expect(find.text('أهلًا أحمد'), findsOneWidget);
    expect(find.text('مستواك: مبتدئ'), findsOneWidget);
    expect(find.text('جولة منوّعة'), findsOneWidget);
  });

  testWidgets('a returning player goes straight home, in right-to-left layout', (tester) async {
    await tester.pumpWidget(QuizApp(api: FakeGameApi(player: const Player(name: 'سارة', level: 'intermediate'))));
    await tester.pumpAndSettle();
    expect(find.text('أهلًا سارة'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('أهلًا سارة'))), TextDirection.rtl);
  });

  testWidgets('a full round: answer, see the benefit and source, then the summary', (tester) async {
    final api = FakeGameApi(promoteTo: 'intermediate');
    await tester.pumpWidget(wrap(RoundScreen(api: api, categoryId: null)));
    await tester.pump();
    await tester.pump();

    expect(find.text('السؤال 1 من 3'), findsOneWidget);
    await tester.tap(find.text('السيد الذي تصمد إليه الخلائق'));
    await tester.pump();
    await tester.pump();
    expect(find.text('إجابة صحيحة: 15 نقطة'), findsOneWidget);
    expect(find.text('فائدة السؤال 1'), findsOneWidget);
    expect(find.text('المصدر: تفسير السعدي، تفسير الآية 112:1'), findsOneWidget);

    await tester.tap(find.text('السؤال التالي'));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('خطأ'));
    await tester.pump();
    await tester.pump();
    expect(find.text('إجابة غير صحيحة'), findsOneWidget);
    expect(find.text('صواب'), findsOneWidget); // الإجابة الصحيحة تُعرض

    await tester.tap(find.text('السؤال التالي'));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('تأكيد الترتيب'));
    await tester.pump();
    await tester.pump();
    expect(api.answers, [0, false, ['الأول', 'الثاني', 'الثالث']]);

    await tester.tap(find.text('عرض النتيجة'));
    await tester.pumpAndSettle();
    expect(find.text('30 نقطة'), findsOneWidget);
    expect(find.text('2 إجابات صحيحة من 3'), findsOneWidget);
    expect(find.textContaining('انتقلت إلى المستوى «متوسط»'), findsOneWidget);
  });

  testWidgets('when the 20 seconds run out the question times out', (tester) async {
    final api = FakeGameApi();
    await tester.pumpWidget(wrap(RoundScreen(api: api, categoryId: 1)));
    await tester.pump();
    await tester.pump();
    expect(find.text('20 ثانية'), findsOneWidget);

    await tester.pump(const Duration(seconds: 10));
    expect(find.text('10 ثانية'), findsOneWidget);
    await tester.pump(const Duration(seconds: 11));
    await tester.pump();
    expect(api.answers, [null]);
    expect(find.text('انتهى الوقت'), findsOneWidget);
  });

  testWidgets('a player reports a mistake from the answer screen', (tester) async {
    final api = FakeGameApi();
    await tester.pumpWidget(wrap(RoundScreen(api: api, categoryId: null)));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('الخالق'));
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('إبلاغ عن خطأ في هذا السؤال'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'الخيارات متشابهة');
    await tester.tap(find.text('إرسال'));
    await tester.pumpAndSettle();
    expect(api.reports, ['q1: الخيارات متشابهة']);
    expect(find.textContaining('وصل البلاغ'), findsOneWidget);
  });

  testWidgets('the leaderboard switches between weekly and all-time and marks me', (tester) async {
    await tester.pumpWidget(wrap(LeaderboardScreen(api: FakeGameApi())));
    await tester.pumpAndSettle();
    expect(find.text('أنا (أنت)'), findsOneWidget);
    expect(find.text('تبدأ لوحة الأسبوع من جديد كل جمعة'), findsOneWidget);

    await tester.tap(find.text('كل الأوقات'));
    await tester.pumpAndSettle();
    expect(find.text('أنا دائمًا (أنت)'), findsOneWidget);
  });
}
