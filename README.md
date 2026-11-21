# المسابقة القرآنية

منصة مسابقات قرآنية يُنتج محتواها ويراجعه الفريق العلمي لمركز تفسير.

| المجلد | ما فيه |
| --- | --- |
| `supabase/` | قاعدة البيانات: الجداول والصلاحيات والدوال، واختبارات pgTAP |
| `admin/` | لوحة الإدارة (Next.js): بنك الأسئلة ومسار المراجعة والفريق والتوليد المساعَد |
| `player/` | تطبيق اللاعب (Flutter): أندرويد وآيفون والويب |
| `content/drafts/` | مسودات أسئلة مولَّدة من المختصر والسعدي، تُستورد بعد فحصها |
| `docs/` | خطط التنفيذ، و[دليل الإطلاق](docs/LAUNCH.md) |

## التشغيل محليًا

يحتاج Docker وNode.js 20+ وFlutter.

```bash
npx supabase start
```

```bash
cd admin && npm install && npm run dev
```

```bash
cd player && flutter run -d chrome --dart-define=SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
```

## الاختبارات

```bash
npx supabase test db
```

```bash
cd admin && npm test
```

```bash
cd player && flutter test
```

تعمل كلها تلقائيًا على GitHub مع كل رفع (`.github/workflows/ci.yml`).
