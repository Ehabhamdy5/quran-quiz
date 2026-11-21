# مسودات أسئلة مولَّدة

كل ملف هنا طلبُ توليد واحد: مقطع من آيات (حتى خمس)، وأسئلة مقترحة عليه بصيغة مخرجات صفحة «توليد مساعَد» نفسها،
ولكل سؤال اقتباس حرفي من «المختصر في تفسير القرآن الكريم» أو «تفسير السعدي».

الاستيراد يجلب نص التفسير الحقيقي من خادم Tafsir MCP، ويمرر كل سؤال على الفحص الآلي نفسه (الاقتباس الحرفي،
وحدود الآيات، ومنع النص القرآني في الخيارات)، ثم يحفظ ما يجتازه مسودةً بعلامة «مولَّد آليًا» تمر بالمراجعة العلمية.
وتشغيله مرة ثانية لا يكرر ما حُفظ.

```bash
cd admin
# فحص فقط
TAFSIR_MCP_URL=https://mcp.tafsir.net/mcp npm run import-drafts -- --dry-run ../content/drafts/*.json
# فحص وحفظ (DRAFT_AUTHOR_EMAIL: الكاتب الذي تُنسب إليه المسودات)
TAFSIR_MCP_URL=https://mcp.tafsir.net/mcp SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DRAFT_AUTHOR_EMAIL=... \
  npm run import-drafts -- ../content/drafts/*.json
```
