# دليل الإطلاق التجريبي

الهدف: قاعدة بيانات على الإنترنت، ولوحة إدارة يعمل عليها الفريق العلمي، ونسخة ويب من تطبيق اللاعب لتجربة مغلقة مع نحو 100 مستخدم.

كل الخطوات من المتصفح، ولا تحتاج تثبيت أي برنامج على جهازك. الأسرار (المفاتيح وكلمات المرور) تُكتب في إعدادات GitHub وSupabase والاستضافة فقط، ولا تُرسل في محادثة ولا تُكتب في الكود.

---

## ١. إنشاء قاعدة البيانات (Supabase، مجاني للبداية)

1. أنشئ حسابًا في https://supabase.com ثم **New project**. اختر أقرب منطقة لجمهورك، واحفظ **كلمة مرور قاعدة البيانات** في مكان آمن.
2. من **Authentication > Sign In / Providers**:
   - فعّل **Allow anonymous sign-ins** (يدخل به اللاعبون دون بريد).
   - أبقِ **Allow new users to sign up** مفعّلًا. (حسابات الفريق لا تأخذ صلاحياتها إلا من المدير، فالتسجيل الذاتي لا يعطي أي صلاحية في اللوحة.)
3. احتفظ من **Project Settings** بهذه القيم:
   - **Project URL**، و**Project ref** (الجزء الأول من الرابط).
   - **Publishable key** (أو anon key).
   - **Secret key** (أو service_role key). هذا مفتاح خطير: لا يوضع إلا في الأسرار.
4. أنشئ **Access token** من https://supabase.com/dashboard/account/tokens.

## ٢. أسرار GitHub

في المستودع: **Settings > Secrets and variables > Actions > New repository secret**، أضف:

| الاسم | القيمة |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | الرمز من الخطوة ١-٤ |
| `SUPABASE_DB_PASSWORD` | كلمة مرور قاعدة البيانات |
| `SUPABASE_PROJECT_REF` | Project ref |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key |

## ٣. بناء الجداول

في المستودع: **Actions > deploy-database > Run workflow**. ينشئ الجداول والصلاحيات والدوال كلها. أعده بعد أي تحديث للقاعدة لاحقًا.

## ٤. أول مدير

1. في Supabase: **Authentication > Users > Add user**. اكتب بريدك وكلمة مرور، وفعّل **Auto Confirm User**.
2. في GitHub: **Actions > make-admin > Run workflow**، واكتب البريد نفسه.

## ٥. نشر لوحة الإدارة (Vercel)

1. أنشئ حسابًا في https://vercel.com واربطه بـ GitHub، ثم **Add New > Project** واختر المستودع `quran-quiz`.
2. **Root Directory**: `admin`.
3. **Environment Variables**:

| الاسم | القيمة |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (لإنشاء حسابات الفريق من صفحة «الفريق») |
| `TAFSIR_MCP_URL` | `https://mcp.tafsir.net/mcp` |
| `ANTHROPIC_API_KEY` | اختياري: لزر «توليد مساعَد». بدونه تعمل اللوحة كاملة عدا هذا الزر |

4. **Deploy**. ادخل إلى الرابط الناتج بحساب المدير، ثم أنشئ حسابات الكتّاب والمراجعين من صفحة **الفريق**.

ملاحظة: خطة Vercel المجانية (Hobby) مخصصة للاستعمال الشخصي غير التجاري. إن احتاج المركز خطة مؤسسية فخطة Pro، أو بديل مثل Netlify.

## ٦. المسودات الأولى

1. **Actions > import-drafts > Run workflow**، واكتب بريد أحد الكتّاب. تُستورد المسودات من `content/drafts` بعد فحصها على نص التفسير.
2. في اللوحة: يرسلها الكاتب للمراجعة، ويعتمدها مراجع غير كاتبها، وينشرها المدير. **لا يظهر للاعبين إلا المنشور.**

## ٧. نشر تطبيق اللاعب على الويب (GitHub Pages)

1. **Settings > Pages > Build and deployment > Source**: اختر **GitHub Actions**.
2. **Actions > deploy-player-web > Run workflow**. الرابط يظهر في نهاية التشغيل، وشكله `https://<الحساب>.github.io/quran-quiz/`.

ملاحظة: GitHub Pages متاحة للمستودعات العامة، أو الخاصة في الخطط المدفوعة. إن كان المستودع خاصًا على خطة مجانية فالبديل نشر مجلد `player/build/web` على أي استضافة ملفات ثابتة (Netlify أو Cloudflare Pages).

## ٨. الفحص اليومي للروابط

يعمل تلقائيًا كل يوم بعد إضافة `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` في الخطوة ٢.

---

## قبل دعوة المستخدمين

- [ ] بنك أولي منشور يكفي جولات متنوعة في كل مستوى (الهدف 600 سؤال؛ للتجربة المغلقة يكفي أقل).
- [ ] مراجعة قرارات الخطة 4 (مكافأة التتابع، وشرط الترقية، وظهور الضيف في اللوحات، وحدّ البلاغات) في `docs/superpowers/plans/2026-11-21-player-app.md`.
- [ ] سياسة الخصوصية (مسألة مفتوحة في وثيقة التصميم)، خاصة مع إتاحة اللعب دون بريد.
- [ ] اسم التطبيق وهويته البصرية (مسألة مفتوحة).

## نسختا أندرويد وآيفون

الكود جاهز لهما (Flutter)، والبناء يحتاج جهازًا عليه Android Studio وXcode (Xcode على Mac فقط)، وحساب مطوّر في كل متجر. تُؤجَّل إلى ما بعد التجربة على الويب.
