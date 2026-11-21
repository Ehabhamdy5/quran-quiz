import 'package:material_ui/material_ui.dart';

import '../data/models.dart';

class SummaryScreen extends StatelessWidget {
  const SummaryScreen({super.key, required this.summary});
  final RoundSummary summary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('نتيجة الجولة'), automaticallyImplyLeading: false),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('${summary.score} نقطة', style: theme.textTheme.displaySmall),
            const SizedBox(height: 8),
            Text('${summary.correct} إجابات صحيحة من ${summary.total}', style: theme.textTheme.titleMedium),
            if (summary.promotedTo != null) ...[
              const SizedBox(height: 16),
              Text('بارك الله فيك، انتقلت إلى المستوى «${levelNames[summary.promotedTo] ?? summary.promotedTo}»',
                  textAlign: TextAlign.center, style: theme.textTheme.titleMedium),
            ],
            const SizedBox(height: 24),
            FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('العودة')),
          ]),
        ),
      ),
    );
  }
}
