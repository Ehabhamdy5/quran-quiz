# خطة تنفيذ: بنك الأسئلة ولوحة الإدارة (الخطة 1 من 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**الهدف:** لوحة إدارة يكتب فيها فريق مركز تفسير أسئلة المسابقة القرآنية بمصادرها ووسائطها، وتمرّ بمسار مراجعة علمية مُلزِم قبل النشر.

**البنية:** قاعدة Supabase (PostgreSQL) تفرض القواعد بنفسها: الصلاحيات عبر RLS، وتغيير الحالة لا يتم إلا عبر الدالة `transition_question`، ونطاقات الوسائط تُفحص بمُشغِّل (trigger). لوحة Next.js رقيقة فوقها، تتحقق من المدخلات مبكرًا وتعرض رسائل القاعدة كما هي.

**التقنيات:** Supabase CLI و PostgreSQL و pgTAP للاختبار، و Next.js 15 (App Router) و TypeScript و Tailwind و `@supabase/ssr` و Zod 3 و Vitest.

**المرجع:** وثيقة التصميم «وثيقة تصميم منصة المسابقة القرآنية». احفظ هذه الخطة في المستودع على المسار `docs/superpowers/plans/2026-11-20-question-bank-admin.md`.

**المتطلبات:** Node.js 20 أو أحدث، و Docker يعمل (يحتاجه Supabase المحلي)، و git.

**خارج نطاق هذه الخطة (لكل منها خطة لاحقة):** فاحص الروابط اليومي، والتوليد المساعَد من كتب التفسير، وواجهة إدارة المواقع المسموح بها (الصلاحية جاهزة في القاعدة)، وتطبيق اللاعب بما فيه زر البلاغ وإعادة معايرة الصعوبة، والتحدي المباشر. والتضمين من مواقع فيديو غير يوتيوب مؤجَّل كذلك؛ هذه الخطة تدعم يوتيوب والروابط المباشرة للملفات.

---

## خريطة الملفات

```
quran-quiz/
├── supabase/
│   ├── config.toml                                   (من supabase init؛ نعدّل enable_signup)
│   ├── migrations/
│   │   ├── 20261120000100_core_schema.sql            الأنواع والجداول والبيانات المرجعية وإنشاء الملف الشخصي
│   │   ├── 20261120000200_rls.sql                    الصلاحيات وحارس التعديل
│   │   ├── 20261120000300_transitions.sql            دالة مسار المراجعة
│   │   └── 20261120000400_media_domains.sql          فحص نطاق روابط الوسائط
│   └── tests/database/
│       ├── 01_schema.test.sql
│       ├── 02_rls.test.sql
│       ├── 03_transitions.test.sql
│       └── 04_media.test.sql
└── admin/                                            (Next.js)
    ├── vitest.config.ts
    └── src/
        ├── middleware.ts                             تحديث الجلسة وتحويل غير المسجَّل إلى /login
        ├── lib/
        │   ├── media.ts (+ media.test.ts)            تحليل روابط يوتيوب والتحقق من الوسائط
        │   ├── question-schema.ts (+ test)           التحقق من نموذج السؤال وتحويله إلى صف
        │   ├── status.ts (+ test)                    أسماء الحالات والانتقالات المتاحة في الواجهة
        │   └── supabase/server.ts                    عميل Supabase للخادم
        ├── components/
        │   ├── QuestionForm.tsx                      نموذج الإنشاء والتعديل
        │   ├── MediaPreview.tsx                      معاينة الوسيط كما سيراه اللاعب
        │   └── TransitionPanel.tsx                   أزرار مسار المراجعة
        └── app/
            ├── layout.tsx, page.tsx
            ├── login/page.tsx, login/actions.ts
            └── questions/
                ├── layout.tsx, page.tsx, actions.ts
                ├── new/page.tsx
                └── [id]/page.tsx
```

---

### المهمة 1: تهيئة المستودع

**الملفات:**
- إنشاء: `quran-quiz/` (المستودع)، و`supabase/`، و`admin/`
- تعديل: `supabase/config.toml`

- [ ] **الخطوة 1: إنشاء المستودع وتهيئة Supabase**

```bash
mkdir quran-quiz && cd quran-quiz
git init
npx supabase@latest init
```

المتوقع: يُنشأ المجلد `supabase/` وفيه `config.toml`.

- [ ] **الخطوة 2: منع التسجيل الذاتي**

حسابات الفريق ينشئها المدير فقط. في `supabase/config.toml` داخل القسم `[auth]` اجعل السطر:

```toml
enable_signup = false
```

- [ ] **الخطوة 3: تشغيل Supabase المحلي**

```bash
npx supabase start
```

المتوقع: قائمة فيها `API URL` و`anon key` و`Studio URL` (عادةً http://localhost:54323). احتفظ بها.

- [ ] **الخطوة 4: إنشاء تطبيق Next.js وتثبيت الحزم**

```bash
npx create-next-app@15 admin --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
cd admin
npm install @supabase/supabase-js @supabase/ssr zod@3
npm install -D vitest
```

- [ ] **الخطوة 5: إعداد Vitest**

أنشئ `admin/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node' },
});
```

وفي `admin/package.json` أضف إلى `scripts`:

```json
"test": "vitest run"
```

- [ ] **الخطوة 6: متغيرات البيئة**

أنشئ `admin/.env.local` بالقيم من الخطوة 3:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

- [ ] **الخطوة 7: Commit**

```bash
cd ..
git add .
git commit -m "chore: scaffold supabase and next.js admin"
```

---

### المهمة 2: المخطط الأساسي للقاعدة

**الملفات:**
- إنشاء: `supabase/migrations/20261120000100_core_schema.sql`
- اختبار: `supabase/tests/database/01_schema.test.sql`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`supabase/tests/database/01_schema.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_table('public', 'questions', 'questions table exists');
select has_table('public', 'question_media', 'question_media table exists');
select is((select count(*)::int from public.categories), 4, 'four categories are seeded');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'new@test.local');
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'writer',
  'a new user gets a writer profile'
);

select * from finish();
rollback;
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npx supabase test db
```

المتوقع: FAIL، والسبب `relation "public.categories" does not exist`.

- [ ] **الخطوة 3: كتابة الترحيل**

`supabase/migrations/20261120000100_core_schema.sql`:

```sql
create type public.user_role as enum ('writer', 'reviewer', 'admin');
create type public.question_status as enum ('draft', 'in_review', 'needs_changes', 'approved', 'published', 'suspended');
create type public.question_type as enum ('mcq', 'true_false', 'visual', 'ordering');
create type public.difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.question_origin as enum ('human', 'ai');
create type public.media_placement as enum ('question', 'answer');
create type public.media_kind as enum ('image', 'video');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.user_role not null default 'writer'
);

create table public.categories (
  id smallint primary key,
  slug text not null unique,
  name_ar text not null
);

insert into public.categories (id, slug, name_ar) values
  (1, 'tafsir', 'التفسير'),
  (2, 'word_meanings', 'معاني الكلمات'),
  (3, 'quran_stories', 'قصص القرآن'),
  (4, 'prophets', 'قصص الأنبياء');

create table public.allowed_media_domains (
  domain text primary key check (domain = lower(domain))
);

insert into public.allowed_media_domains (domain) values ('youtube.com'), ('youtu.be');

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (length(trim(prompt)) > 0),
  type public.question_type not null,
  category_id smallint not null references public.categories (id),
  difficulty public.difficulty not null,
  options jsonb,
  correct_answer jsonb,
  benefit text not null check (length(trim(benefit)) > 0),
  source_book text not null check (length(trim(source_book)) > 0),
  source_volume text,
  source_page text not null check (length(trim(source_page)) > 0),
  surah smallint check (surah between 1 and 114),
  ayah smallint check (ayah >= 1),
  origin public.question_origin not null default 'human',
  status public.question_status not null default 'draft',
  author_id uuid not null default auth.uid() references public.profiles (id),
  reviewer_id uuid references public.profiles (id),
  review_notes text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((surah is null) = (ayah is null))
);

create index questions_status_updated_idx on public.questions (status, updated_at desc);

create table public.question_media (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  placement public.media_placement not null,
  kind public.media_kind not null,
  url text not null check (url ~* '^https://'),
  start_seconds integer check (start_seconds >= 0),
  end_seconds integer,
  alt_text text not null check (length(trim(alt_text)) > 0),
  created_at timestamptz not null default now(),
  check (start_seconds is null or end_seconds is null or end_seconds > start_seconds),
  unique (question_id, placement)
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email, 'مستخدم'));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

- [ ] **الخطوة 4: التطبيق والاختبار**

```bash
npx supabase db reset
npx supabase test db
```

المتوقع: `01_schema.test.sql .. ok` و`All tests successful`.

- [ ] **الخطوة 5: Commit**

```bash
git add supabase
git commit -m "feat(db): core question bank schema"
```

---

### المهمة 3: الصلاحيات (RLS) وحارس التعديل

**الملفات:**
- إنشاء: `supabase/migrations/20261120000200_rls.sql`
- اختبار: `supabase/tests/database/02_rls.test.sql`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`supabase/tests/database/02_rls.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'reviewer@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local');
update public.profiles set role = 'reviewer' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page)
  values ('10000000-0000-0000-0000-000000000001', 'سؤال اختبار', 'mcq', 1, 'beginner', '["أ","ب","ج","د"]', '0', 'فائدة', 'مصدر اختبار', '1')
$$, 'a writer can create a draft');

select throws_ok(
  $$ update public.questions set status = 'approved' where id = '10000000-0000-0000-0000-000000000001' $$,
  'P0001', 'لا تتغير حالة السؤال إلا عبر مسار المراجعة',
  'a direct status change is blocked'
);

select lives_ok(
  $$ update public.questions set prompt = 'سؤال معدّل' where id = '10000000-0000-0000-0000-000000000001' $$,
  'the author can edit a draft'
);

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select throws_ok($$
  insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page)
  values ('10000000-0000-0000-0000-000000000002', 'سؤال', 'true_false', 1, 'beginner', null, 'true', 'فائدة', 'مصدر اختبار', '1')
$$, '42501', null, 'a reviewer cannot create questions');

do $$ begin
  update public.questions set prompt = 'تعديل غير مسموح' where id = '10000000-0000-0000-0000-000000000001';
end $$;
select is(
  (select prompt from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'سؤال معدّل',
  'a reviewer cannot edit question content'
);

reset role;
set local role anon;
select is((select count(*)::int from public.questions), 0, 'anonymous users see no questions');

select * from finish();
rollback;
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npx supabase test db
```

المتوقع: FAIL في `02_rls.test.sql`، لأن التغيير المباشر للحالة ينجح ولأن المستخدم المجهول يرى الأسئلة.

- [ ] **الخطوة 3: كتابة الترحيل**

`supabase/migrations/20261120000200_rls.sql`:

```sql
create function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.can_edit_question(q_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.questions q
    where q.id = q_id
      and q.status in ('draft', 'needs_changes', 'suspended')
      and (q.author_id = auth.uid() or public.my_role() = 'admin')
  )
$$;

-- أي تعديل خارج transition_question لا يغيّر الحالة ولا حقول المراجعة.
create function public.guard_question_update() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.in_transition', true), '') <> 'on' then
    if new.status is distinct from old.status then
      raise exception 'لا تتغير حالة السؤال إلا عبر مسار المراجعة';
    end if;
    new.author_id := old.author_id;
    new.origin := old.origin;
    new.reviewer_id := old.reviewer_id;
    new.review_notes := old.review_notes;
    new.approved_at := old.approved_at;
    new.published_at := old.published_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger questions_guard_update
before update on public.questions
for each row execute function public.guard_question_update();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.allowed_media_domains enable row level security;
alter table public.questions enable row level security;
alter table public.question_media enable row level security;

create policy profiles_staff_read on public.profiles
  for select to authenticated using (public.my_role() is not null);

create policy categories_read on public.categories
  for select to authenticated using (true);

create policy domains_read on public.allowed_media_domains
  for select to authenticated using (true);
create policy domains_admin_write on public.allowed_media_domains
  for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy questions_staff_read on public.questions
  for select to authenticated using (public.my_role() is not null);
create policy questions_insert on public.questions
  for insert to authenticated with check (
    public.my_role() in ('writer', 'admin')
    and author_id = auth.uid()
    and status = 'draft'
    and reviewer_id is null and approved_at is null and published_at is null
  );
create policy questions_update on public.questions
  for update to authenticated using (public.can_edit_question(id)) with check (true);
create policy questions_delete on public.questions
  for delete to authenticated using (
    status = 'draft' and (author_id = auth.uid() or public.my_role() = 'admin')
  );

create policy media_staff_read on public.question_media
  for select to authenticated using (public.my_role() is not null);
create policy media_insert on public.question_media
  for insert to authenticated with check (public.can_edit_question(question_id));
create policy media_update on public.question_media
  for update to authenticated
  using (public.can_edit_question(question_id)) with check (public.can_edit_question(question_id));
create policy media_delete on public.question_media
  for delete to authenticated using (public.can_edit_question(question_id));
```

- [ ] **الخطوة 4: التطبيق والاختبار**

```bash
npx supabase db reset
npx supabase test db
```

المتوقع: كل الاختبارات تنجح.

- [ ] **الخطوة 5: Commit**

```bash
git add supabase
git commit -m "feat(db): row level security and update guard"
```

---

### المهمة 4: دالة مسار المراجعة

**الملفات:**
- إنشاء: `supabase/migrations/20261120000300_transitions.sql`
- اختبار: `supabase/tests/database/03_transitions.test.sql`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`supabase/tests/database/03_transitions.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'reviewer@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local');
update public.profiles set role = 'reviewer' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';

set local role authenticated;

-- الكاتب
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page)
values ('10000000-0000-0000-0000-000000000001', 'سؤال اختبار', 'mcq', 1, 'beginner', '["أ","ب","ج","د"]', '0', 'فائدة', 'مصدر اختبار', '1');
insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page)
values ('10000000-0000-0000-0000-000000000003', 'سؤال مرئي', 'visual', 3, 'beginner', '["أ","ب","ج","د"]', '1', 'فائدة', 'مصدر اختبار', '1');

select throws_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000001', 'approved') $$,
  'P0001', 'الانتقال من draft إلى approved غير مسموح', 'a draft cannot jump to approved');
select lives_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000001', 'in_review') $$,
  'the author submits for review');
select is((select status::text from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'in_review', 'the question is in review');
select throws_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000001', 'approved') $$,
  'P0001', 'الاعتماد للمراجعين فقط', 'a writer cannot approve');
select throws_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000003', 'in_review') $$,
  'P0001', 'السؤال المرئي يحتاج وسيطًا مع السؤال', 'a visual question needs question media before review');

-- المراجع
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select throws_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000001', 'needs_changes') $$,
  'P0001', 'ملاحظات المراجعة مطلوبة عند الإعادة للتعديل', 'returning a question requires notes');
select lives_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000001', 'approved') $$,
  'a reviewer approves someone else''s question');
select is((select reviewer_id::text from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000b', 'the approving reviewer is recorded');
select throws_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000001', 'published') $$,
  'P0001', 'النشر للمدير فقط', 'a reviewer cannot publish');

-- المدير
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select lives_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000001', 'published') $$,
  'an admin publishes an approved question');

insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page)
values ('10000000-0000-0000-0000-000000000002', 'سؤال المدير', 'true_false', 1, 'beginner', null, 'true', 'فائدة', 'مصدر اختبار', '1');
do $$ begin
  perform public.transition_question('10000000-0000-0000-0000-000000000002', 'in_review');
end $$;
select throws_ok($$ select public.transition_question('10000000-0000-0000-0000-000000000002', 'approved') $$,
  'P0001', 'لا يجوز اعتماد سؤال كتبته بنفسك', 'nobody approves their own question, admins included');

select * from finish();
rollback;
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npx supabase test db
```

المتوقع: FAIL في `03_transitions.test.sql`، والسبب `function public.transition_question(...) does not exist`.

- [ ] **الخطوة 3: كتابة الترحيل**

`supabase/migrations/20261120000300_transitions.sql`:

```sql
create function public.transition_question(
  q_id uuid,
  target public.question_status,
  notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  q public.questions;
  r public.user_role := public.my_role();
  me uuid := auth.uid();
begin
  if r is null then
    raise exception 'هذا الحساب ليس من فريق المحتوى';
  end if;

  select * into q from public.questions where id = q_id for update;
  if not found then
    raise exception 'السؤال غير موجود';
  end if;

  if q.status in ('draft', 'needs_changes') and target = 'in_review' then
    if not (q.author_id = me or r = 'admin') then
      raise exception 'الإرسال للمراجعة لكاتب السؤال أو المدير';
    end if;
  elsif q.status = 'in_review' and target = 'approved' then
    if r not in ('reviewer', 'admin') then
      raise exception 'الاعتماد للمراجعين فقط';
    end if;
    if q.author_id = me then
      raise exception 'لا يجوز اعتماد سؤال كتبته بنفسك';
    end if;
  elsif q.status = 'in_review' and target = 'needs_changes' then
    if r not in ('reviewer', 'admin') then
      raise exception 'الإعادة للتعديل للمراجعين فقط';
    end if;
    if coalesce(trim(notes), '') = '' then
      raise exception 'ملاحظات المراجعة مطلوبة عند الإعادة للتعديل';
    end if;
  elsif q.status = 'approved' and target = 'published' then
    if r <> 'admin' then
      raise exception 'النشر للمدير فقط';
    end if;
  elsif q.status = 'published' and target = 'suspended' then
    if r <> 'admin' then
      raise exception 'الإيقاف للمدير فقط';
    end if;
  elsif q.status = 'suspended' and target = 'in_review' then
    if r <> 'admin' then
      raise exception 'إعادة السؤال الموقوف للمراجعة للمدير فقط';
    end if;
  else
    raise exception '%', format('الانتقال من %s إلى %s غير مسموح', q.status, target);
  end if;

  if target = 'in_review' and q.type = 'visual' and not exists (
    select 1 from public.question_media m where m.question_id = q.id and m.placement = 'question'
  ) then
    raise exception 'السؤال المرئي يحتاج وسيطًا مع السؤال';
  end if;

  perform set_config('app.in_transition', 'on', true);
  update public.questions set
    status = target,
    reviewer_id = case when target in ('approved', 'needs_changes') then me else reviewer_id end,
    review_notes = case
      when target = 'needs_changes' then trim(notes)
      when target = 'approved' then null
      else review_notes end,
    approved_at = case when target = 'approved' then now() else approved_at end,
    published_at = case when target = 'published' then now() else published_at end
  where id = q_id;
  perform set_config('app.in_transition', 'off', true);
end $$;
```

- [ ] **الخطوة 4: التطبيق والاختبار**

```bash
npx supabase db reset
npx supabase test db
```

المتوقع: كل الاختبارات تنجح.

- [ ] **الخطوة 5: Commit**

```bash
git add supabase
git commit -m "feat(db): review workflow transitions"
```

---

### المهمة 5: فحص نطاق روابط الوسائط في القاعدة

**الملفات:**
- إنشاء: `supabase/migrations/20261120000400_media_domains.sql`
- اختبار: `supabase/tests/database/04_media.test.sql`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`supabase/tests/database/04_media.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'reviewer@test.local');
update public.profiles set role = 'reviewer' where id = '00000000-0000-0000-0000-00000000000b';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page)
values ('10000000-0000-0000-0000-000000000001', 'سؤال اختبار', 'mcq', 1, 'beginner', '["أ","ب","ج","د"]', '0', 'فائدة', 'مصدر اختبار', '1');

select lives_ok($$
  insert into public.question_media (question_id, placement, kind, url, start_seconds, end_seconds, alt_text)
  values ('10000000-0000-0000-0000-000000000001', 'answer', 'video', 'https://www.youtube.com/watch?v=abcdefghijk', 10, 40, 'شرح الإجابة')
$$, 'a YouTube link is accepted');

select throws_ok($$
  insert into public.question_media (question_id, placement, kind, url, alt_text)
  values ('10000000-0000-0000-0000-000000000001', 'question', 'video', 'https://example.com/clip.mp4', 'لقطة')
$$, 'P0001', 'الرابط ليس من المواقع المسموح بها', 'a link from an unlisted site is rejected');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select throws_ok($$
  insert into public.question_media (question_id, placement, kind, url, alt_text)
  values ('10000000-0000-0000-0000-000000000001', 'question', 'video', 'https://youtu.be/abcdefghijk', 'لقطة')
$$, '42501', null, 'a reviewer cannot attach media');

select * from finish();
rollback;
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npx supabase test db
```

المتوقع: FAIL في الاختبار الثاني من `04_media.test.sql`، لأن رابط example.com يُقبل.

- [ ] **الخطوة 3: كتابة الترحيل**

`supabase/migrations/20261120000400_media_domains.sql`:

```sql
create function public.check_media_domain() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  host text := lower(substring(new.url from '^https://([^/:?#]+)'));
begin
  if host is null or not exists (
    select 1 from public.allowed_media_domains d
    where host = d.domain or host like '%.' || d.domain
  ) then
    raise exception 'الرابط ليس من المواقع المسموح بها';
  end if;
  return new;
end $$;

create trigger question_media_check_domain
before insert or update of url on public.question_media
for each row execute function public.check_media_domain();
```

- [ ] **الخطوة 4: التطبيق والاختبار**

```bash
npx supabase db reset
npx supabase test db
```

المتوقع: `All tests successful` للملفات الأربعة.

- [ ] **الخطوة 5: Commit**

```bash
git add supabase
git commit -m "feat(db): allowed media domains check"
```

---

### المهمة 6: مكتبة الوسائط

**الملفات:**
- إنشاء: `admin/src/lib/media.ts`
- اختبار: `admin/src/lib/media.test.ts`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`admin/src/lib/media.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseYouTubeId, isAllowedDomain, validateMedia, youTubeEmbedUrl, readMediaFields } from './media';

const ID = 'abcdefghijk';

describe('parseYouTubeId', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://m.youtube.com/watch?v=${ID}&t=30`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/embed/${ID}`],
  ])('extracts the id from %s', (url) => {
    expect(parseYouTubeId(url)).toBe(ID);
  });

  it('returns null for other hosts, bad ids and non-urls', () => {
    expect(parseYouTubeId('https://vimeo.com/123')).toBeNull();
    expect(parseYouTubeId('https://youtu.be/short')).toBeNull();
    expect(parseYouTubeId('not a url')).toBeNull();
  });
});

describe('isAllowedDomain', () => {
  const allowed = ['youtube.com', 'youtu.be'];

  it('accepts a listed domain and its subdomains over https', () => {
    expect(isAllowedDomain(`https://youtube.com/watch?v=${ID}`, allowed)).toBe(true);
    expect(isAllowedDomain(`https://www.youtube.com/watch?v=${ID}`, allowed)).toBe(true);
  });

  it('rejects http, look-alike hosts and unlisted sites', () => {
    expect(isAllowedDomain(`http://www.youtube.com/watch?v=${ID}`, allowed)).toBe(false);
    expect(isAllowedDomain('https://notyoutube.com/x', allowed)).toBe(false);
    expect(isAllowedDomain('https://example.com/x.mp4', allowed)).toBe(false);
  });
});

describe('validateMedia', () => {
  it('passes a valid clip', () => {
    expect(
      validateMedia(
        { url: `https://www.youtube.com/watch?v=${ID}`, kind: 'video', startSeconds: 10, endSeconds: 40, altText: 'وصف' },
        ['youtube.com'],
      ),
    ).toEqual([]);
  });

  it('reports an end before the start and a missing alt text', () => {
    const errors = validateMedia(
      { url: `https://www.youtube.com/watch?v=${ID}`, kind: 'video', startSeconds: 40, endSeconds: 10, altText: ' ' },
      ['youtube.com'],
    );
    expect(errors).toContain('وقت النهاية يجب أن يكون بعد وقت البداية');
    expect(errors).toContain('الوصف النصي البديل مطلوب');
  });

  it('rejects clip times on images', () => {
    expect(
      validateMedia(
        { url: 'https://example.org/image.png', kind: 'image', startSeconds: 5, endSeconds: null, altText: 'صورة' },
        ['example.org'],
      ),
    ).toContain('وقت البداية والنهاية للفيديو فقط');
  });
});

describe('youTubeEmbedUrl', () => {
  it('builds a privacy-enhanced embed with start, end and rel=0', () => {
    const u = new URL(youTubeEmbedUrl(ID, 10, 40));
    expect(u.hostname).toBe('www.youtube-nocookie.com');
    expect(u.pathname).toBe(`/embed/${ID}`);
    expect(u.searchParams.get('start')).toBe('10');
    expect(u.searchParams.get('end')).toBe('40');
    expect(u.searchParams.get('rel')).toBe('0');
  });
});

describe('readMediaFields', () => {
  it('returns null when no url is given', () => {
    expect(readMediaFields(new FormData(), 'question')).toBeNull();
  });

  it('reads the fields of one placement', () => {
    const fd = new FormData();
    fd.set('answer_media_url', ` https://youtu.be/${ID} `);
    fd.set('answer_media_kind', 'video');
    fd.set('answer_media_start', '5');
    fd.set('answer_media_end', '');
    fd.set('answer_media_alt', 'شرح');
    expect(readMediaFields(fd, 'answer')).toEqual({
      url: `https://youtu.be/${ID}`,
      kind: 'video',
      startSeconds: 5,
      endSeconds: null,
      altText: 'شرح',
    });
  });
});
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
cd admin && npm test -- src/lib/media.test.ts
```

المتوقع: FAIL، والسبب `Failed to resolve import "./media"`.

- [ ] **الخطوة 3: كتابة التنفيذ**

`admin/src/lib/media.ts`:

```ts
export type MediaKind = 'image' | 'video';
export type Placement = 'question' | 'answer';

export type MediaInput = {
  url: string;
  kind: MediaKind;
  startSeconds: number | null;
  endSeconds: number | null;
  altText: string;
};

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];

export function parseYouTubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.includes(host)) return null;

  let id: string | null;
  if (host === 'youtu.be') {
    id = u.pathname.slice(1).split('/')[0] || null;
  } else if (u.pathname === '/watch') {
    id = u.searchParams.get('v');
  } else {
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
    id = m ? m[2] : null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function isAllowedDomain(raw: string, allowed: string[]): boolean {
  let host: string;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowed.some((d) => {
    const domain = d.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  });
}

export function validateMedia(m: MediaInput, allowed: string[]): string[] {
  const errors: string[] = [];
  if (!isAllowedDomain(m.url, allowed)) {
    errors.push('الرابط ليس من المواقع المسموح بها أو لا يبدأ بـ https');
  }
  if (!m.altText.trim()) errors.push('الوصف النصي البديل مطلوب');
  if (m.kind === 'image' && (m.startSeconds !== null || m.endSeconds !== null)) {
    errors.push('وقت البداية والنهاية للفيديو فقط');
  }
  if (m.startSeconds !== null && m.startSeconds < 0) errors.push('وقت البداية لا يكون سالبًا');
  if (m.startSeconds !== null && m.endSeconds !== null && m.endSeconds <= m.startSeconds) {
    errors.push('وقت النهاية يجب أن يكون بعد وقت البداية');
  }
  return errors;
}

export function youTubeEmbedUrl(id: string, start?: number | null, end?: number | null): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
  if (start != null) params.set('start', String(start));
  if (end != null) params.set('end', String(end));
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function readMediaFields(fd: FormData, placement: Placement): MediaInput | null {
  const get = (key: string) => String(fd.get(`${placement}_media_${key}`) ?? '').trim();
  const url = get('url');
  if (!url) return null;
  const num = (key: string) => (get(key) === '' ? null : Number(get(key)));
  return {
    url,
    kind: get('kind') === 'image' ? 'image' : 'video',
    startSeconds: num('start'),
    endSeconds: num('end'),
    altText: get('alt'),
  };
}
```

- [ ] **الخطوة 4: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test -- src/lib/media.test.ts
```

المتوقع: PASS لكل الحالات.

- [ ] **الخطوة 5: Commit**

```bash
git add src/lib/media.ts src/lib/media.test.ts
git commit -m "feat(admin): media link parsing and validation"
```

---

### المهمة 7: التحقق من نموذج السؤال

**الملفات:**
- إنشاء: `admin/src/lib/question-schema.ts`
- اختبار: `admin/src/lib/question-schema.test.ts`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`admin/src/lib/question-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseQuestionForm, toRow } from './question-schema';

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

const base = {
  prompt: 'سؤال',
  categoryId: '1',
  difficulty: 'beginner',
  benefit: 'فائدة',
  sourceBook: 'مصدر',
  sourceVolume: '',
  sourcePage: '12',
  surah: '',
  ayah: '',
};

const messages = (r: ReturnType<typeof parseQuestionForm>) =>
  r.success ? [] : r.error.issues.map((i) => i.message);

describe('parseQuestionForm', () => {
  it('accepts a complete multiple-choice question', () => {
    const r = parseQuestionForm(form({ ...base, type: 'mcq', option: ['أ', 'ب', 'ج', 'د'], correct: '2' }));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(toRow(r.data)).toMatchObject({
        type: 'mcq',
        options: ['أ', 'ب', 'ج', 'د'],
        correct_answer: 2,
        source_volume: null,
        surah: null,
        ayah: null,
      });
    }
  });

  it('rejects a multiple-choice question with an empty option', () => {
    const r = parseQuestionForm(form({ ...base, type: 'mcq', option: ['أ', '', 'ج', 'د'], correct: '0' }));
    expect(messages(r)).toContain('أدخل أربعة خيارات غير فارغة');
  });

  it('rejects a multiple-choice question with no correct answer', () => {
    const r = parseQuestionForm(form({ ...base, type: 'mcq', option: ['أ', 'ب', 'ج', 'د'] }));
    expect(messages(r)).toContain('اختر الإجابة الصحيحة');
  });

  it('stores true/false answers as booleans with no options', () => {
    const r = parseQuestionForm(form({ ...base, type: 'true_false', correct: 'false' }));
    expect(r.success).toBe(true);
    if (r.success) expect(toRow(r.data)).toMatchObject({ options: null, correct_answer: false });
  });

  it('keeps ordering items in order and drops empty inputs', () => {
    const r = parseQuestionForm(form({ ...base, type: 'ordering', option: ['أول', 'ثان', 'ثالث', '', '', ''] }));
    expect(r.success).toBe(true);
    if (r.success) expect(toRow(r.data)).toMatchObject({ options: ['أول', 'ثان', 'ثالث'], correct_answer: null });
  });

  it('requires surah and ayah together', () => {
    const r = parseQuestionForm(form({ ...base, type: 'true_false', correct: 'true', surah: '12' }));
    expect(messages(r)).toContain('أدخل السورة والآية معًا أو اتركهما معًا');
  });
});
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npm test -- src/lib/question-schema.test.ts
```

المتوقع: FAIL، والسبب `Failed to resolve import "./question-schema"`.

- [ ] **الخطوة 3: كتابة التنفيذ**

`admin/src/lib/question-schema.ts`:

```ts
import { z } from 'zod';

export const TYPE_LABELS = {
  mcq: 'اختيار من متعدد',
  true_false: 'صواب أو خطأ',
  visual: 'سؤال مرئي',
  ordering: 'ترتيب',
} as const;

export const DIFFICULTY_LABELS = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
} as const;

export type QuestionType = keyof typeof TYPE_LABELS;
export type Difficulty = keyof typeof DIFFICULTY_LABELS;

export type QuestionRow = {
  id: string;
  prompt: string;
  type: QuestionType;
  category_id: number;
  difficulty: Difficulty;
  options: string[] | null;
  correct_answer: number | boolean | null;
  benefit: string;
  source_book: string;
  source_volume: string | null;
  source_page: string;
  surah: number | null;
  ayah: number | null;
  origin: 'human' | 'ai';
  status: string;
  author_id: string;
  review_notes: string | null;
};

export const questionSchema = z
  .object({
    prompt: z.string().trim().min(1, 'نص السؤال مطلوب'),
    type: z.enum(['mcq', 'true_false', 'visual', 'ordering'], { errorMap: () => ({ message: 'اختر نوع السؤال' }) }),
    categoryId: z.number({ invalid_type_error: 'اختر التصنيف' }).int().min(1).max(4),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced'], { errorMap: () => ({ message: 'اختر المستوى' }) }),
    benefit: z.string().trim().min(1, 'الفائدة مطلوبة'),
    sourceBook: z.string().trim().min(1, 'اسم المصدر مطلوب'),
    sourceVolume: z.string().trim().nullable(),
    sourcePage: z.string().trim().min(1, 'رقم الصفحة مطلوب'),
    surah: z.number().int().min(1, 'رقم السورة بين 1 و114').max(114, 'رقم السورة بين 1 و114').nullable(),
    ayah: z.number().int().min(1, 'رقم الآية يبدأ من 1').nullable(),
    options: z.array(z.string().trim()),
    correct: z.union([z.number().int(), z.boolean(), z.null()]),
  })
  .superRefine((q, ctx) => {
    if ((q.surah === null) !== (q.ayah === null)) {
      ctx.addIssue({ code: 'custom', path: ['ayah'], message: 'أدخل السورة والآية معًا أو اتركهما معًا' });
    }
    if (q.type === 'mcq' || q.type === 'visual') {
      if (q.options.length !== 4 || q.options.some((o) => o === '')) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'أدخل أربعة خيارات غير فارغة' });
      }
      if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) {
        ctx.addIssue({ code: 'custom', path: ['correct'], message: 'اختر الإجابة الصحيحة' });
      }
    } else if (q.type === 'true_false') {
      if (typeof q.correct !== 'boolean') {
        ctx.addIssue({ code: 'custom', path: ['correct'], message: 'اختر صواب أو خطأ' });
      }
    } else if (q.options.length < 3 || q.options.length > 6) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'أدخل من 3 إلى 6 عناصر بترتيبها الصحيح' });
    }
  });

export type QuestionInput = z.infer<typeof questionSchema>;

const text = (v: FormDataEntryValue | null) => String(v ?? '');
const optionalNumber = (v: FormDataEntryValue | null) => {
  const s = text(v).trim();
  return s === '' ? null : Number(s);
};

export function parseQuestionForm(fd: FormData) {
  const type = text(fd.get('type'));
  const correctRaw = text(fd.get('correct'));
  const allOptions = fd.getAll('option').map((o) => String(o).trim());

  let options: string[];
  let correct: number | boolean | null;
  if (type === 'true_false') {
    options = [];
    correct = correctRaw === 'true' ? true : correctRaw === 'false' ? false : null;
  } else if (type === 'ordering') {
    options = allOptions.filter((o) => o !== '');
    correct = null;
  } else {
    options = allOptions;
    correct = correctRaw === '' ? null : Number(correctRaw);
  }

  return questionSchema.safeParse({
    prompt: text(fd.get('prompt')),
    type,
    categoryId: optionalNumber(fd.get('categoryId')),
    difficulty: text(fd.get('difficulty')),
    benefit: text(fd.get('benefit')),
    sourceBook: text(fd.get('sourceBook')),
    sourceVolume: text(fd.get('sourceVolume')).trim() || null,
    sourcePage: text(fd.get('sourcePage')),
    surah: optionalNumber(fd.get('surah')),
    ayah: optionalNumber(fd.get('ayah')),
    options,
    correct,
  });
}

export function toRow(q: QuestionInput) {
  return {
    prompt: q.prompt,
    type: q.type,
    category_id: q.categoryId,
    difficulty: q.difficulty,
    benefit: q.benefit,
    source_book: q.sourceBook,
    source_volume: q.sourceVolume,
    source_page: q.sourcePage,
    surah: q.surah,
    ayah: q.ayah,
    options: q.type === 'true_false' ? null : q.options,
    correct_answer: q.type === 'ordering' ? null : q.correct,
  };
}
```

- [ ] **الخطوة 4: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test -- src/lib/question-schema.test.ts
```

المتوقع: PASS لكل الحالات.

- [ ] **الخطوة 5: Commit**

```bash
git add src/lib/question-schema.ts src/lib/question-schema.test.ts
git commit -m "feat(admin): question form validation"
```

---

### المهمة 8: الحالات والانتقالات في الواجهة

قواعد هذا الملف نسخة من قواعد `transition_question` لإظهار الأزرار المناسبة فقط. القاعدة تبقى هي الحَكَم.

**الملفات:**
- إنشاء: `admin/src/lib/status.ts`
- اختبار: `admin/src/lib/status.test.ts`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`admin/src/lib/status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { availableTransitions, canEdit, isQuestionStatus } from './status';

describe('availableTransitions', () => {
  it('lets the author submit a draft', () => {
    expect(availableTransitions('draft', 'writer', true)).toEqual(['in_review']);
  });

  it('gives other writers nothing on a draft', () => {
    expect(availableTransitions('draft', 'writer', false)).toEqual([]);
  });

  it("lets a reviewer approve or return someone else's question", () => {
    expect(availableTransitions('in_review', 'reviewer', false)).toEqual(['approved', 'needs_changes']);
  });

  it('never offers approval of your own question', () => {
    expect(availableTransitions('in_review', 'admin', true)).toEqual(['needs_changes']);
  });

  it('reserves publishing, suspending and resubmitting for admins', () => {
    expect(availableTransitions('approved', 'reviewer', false)).toEqual([]);
    expect(availableTransitions('approved', 'admin', false)).toEqual(['published']);
    expect(availableTransitions('published', 'admin', false)).toEqual(['suspended']);
    expect(availableTransitions('suspended', 'admin', false)).toEqual(['in_review']);
  });
});

describe('canEdit', () => {
  it('allows editing only in editable states, by the author or an admin', () => {
    expect(canEdit('needs_changes', 'writer', true)).toBe(true);
    expect(canEdit('in_review', 'writer', true)).toBe(false);
    expect(canEdit('published', 'admin', false)).toBe(false);
    expect(canEdit('suspended', 'admin', false)).toBe(true);
    expect(canEdit('draft', 'reviewer', false)).toBe(false);
  });
});

describe('isQuestionStatus', () => {
  it('recognises known statuses only', () => {
    expect(isQuestionStatus('published')).toBe(true);
    expect(isQuestionStatus('deleted')).toBe(false);
  });
});
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npm test -- src/lib/status.test.ts
```

المتوقع: FAIL، والسبب `Failed to resolve import "./status"`.

- [ ] **الخطوة 3: كتابة التنفيذ**

`admin/src/lib/status.ts`:

```ts
export const STATUS_LABELS = {
  draft: 'مسودة',
  in_review: 'قيد المراجعة',
  needs_changes: 'يحتاج تعديلًا',
  approved: 'معتمد',
  published: 'منشور',
  suspended: 'موقوف',
} as const;

export type QuestionStatus = keyof typeof STATUS_LABELS;
export type Role = 'writer' | 'reviewer' | 'admin';

export const ACTION_LABELS: Record<QuestionStatus, string> = {
  draft: 'إعادة إلى مسودة',
  in_review: 'إرسال للمراجعة',
  needs_changes: 'إعادة للتعديل',
  approved: 'اعتماد',
  published: 'نشر',
  suspended: 'إيقاف',
};

const EDITABLE: QuestionStatus[] = ['draft', 'needs_changes', 'suspended'];

export function isQuestionStatus(value: string): value is QuestionStatus {
  return Object.hasOwn(STATUS_LABELS, value);
}

export function canEdit(status: QuestionStatus, role: Role, isAuthor: boolean): boolean {
  return EDITABLE.includes(status) && (isAuthor || role === 'admin');
}

export function availableTransitions(status: QuestionStatus, role: Role, isAuthor: boolean): QuestionStatus[] {
  const reviews = role === 'reviewer' || role === 'admin';
  switch (status) {
    case 'draft':
    case 'needs_changes':
      return isAuthor || role === 'admin' ? ['in_review'] : [];
    case 'in_review': {
      const targets: QuestionStatus[] = [];
      if (reviews && !isAuthor) targets.push('approved');
      if (reviews) targets.push('needs_changes');
      return targets;
    }
    case 'approved':
      return role === 'admin' ? ['published'] : [];
    case 'published':
      return role === 'admin' ? ['suspended'] : [];
    case 'suspended':
      return role === 'admin' ? ['in_review'] : [];
  }
}
```

- [ ] **الخطوة 4: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test
```

المتوقع: PASS لملفات الاختبار الثلاثة.

- [ ] **الخطوة 5: Commit**

```bash
git add src/lib/status.ts src/lib/status.test.ts
git commit -m "feat(admin): status labels and allowed transitions"
```

---

### المهمة 9: الاتصال بـ Supabase وتسجيل الدخول

**الملفات:**
- إنشاء: `admin/src/lib/supabase/server.ts`، `admin/src/middleware.ts`، `admin/src/app/login/actions.ts`، `admin/src/app/login/page.tsx`، `admin/src/app/page.tsx`
- تعديل: `admin/src/app/layout.tsx`

- [ ] **الخطوة 1: عميل الخادم**

`admin/src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // يُستدعى أحيانًا من Server Component حيث الكتابة ممنوعة؛ الـ middleware يحدّث الجلسة.
        }
      },
    },
  });
}
```

- [ ] **الخطوة 2: الـ middleware**

`admin/src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **الخطوة 3: إجراءات الدخول والخروج**

`admin/src/app/login/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(_prev: string | null, fd: FormData): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') ?? ''),
    password: String(fd.get('password') ?? ''),
  });
  if (error) return 'البريد أو كلمة المرور غير صحيحة';
  redirect('/questions');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **الخطوة 4: صفحة الدخول**

`admin/src/app/login/page.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { login } from './actions';

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto mt-24 max-w-sm space-y-4 rounded border bg-white p-6">
      <h1 className="text-xl font-bold">دخول فريق المحتوى</h1>
      <form action={action} className="space-y-3">
        <input name="email" type="email" required placeholder="البريد الإلكتروني" dir="ltr" className="w-full rounded border p-2" />
        <input name="password" type="password" required placeholder="كلمة المرور" dir="ltr" className="w-full rounded border p-2" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="w-full rounded bg-emerald-700 p-2 text-white disabled:opacity-50">
          دخول
        </button>
      </form>
    </main>
  );
}
```

- [ ] **الخطوة 5: التخطيط العام بالعربية واتجاه RTL**

استبدل محتوى `admin/src/app/layout.tsx` كاملًا:

```tsx
import type { Metadata } from 'next';
import { Noto_Kufi_Arabic } from 'next/font/google';
import './globals.css';

const font = Noto_Kufi_Arabic({ subsets: ['arabic'], display: 'swap' });

export const metadata: Metadata = { title: 'لوحة إدارة المسابقة القرآنية' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${font.className} min-h-screen bg-gray-50 text-gray-900`}>{children}</body>
    </html>
  );
}
```

واستبدل محتوى `admin/src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/questions');
}
```

- [ ] **الخطوة 6: التحقق يدويًا**

```bash
npm run dev
```

افتح http://localhost:3000. المتوقع: تحويل إلى `/login` وصفحة الدخول بالعربية من اليمين إلى اليسار. ومحاولة الدخول ببيانات خاطئة تُظهر «البريد أو كلمة المرور غير صحيحة».

- [ ] **الخطوة 7: Commit**

```bash
git add src
git commit -m "feat(admin): supabase session and login"
```

---

### المهمة 10: قائمة الأسئلة

**الملفات:**
- إنشاء: `admin/src/app/questions/layout.tsx`، `admin/src/app/questions/page.tsx`

- [ ] **الخطوة 1: الرأس والتنقل بين الحالات**

`admin/src/app/questions/layout.tsx`:

```tsx
import Link from 'next/link';
import { STATUS_LABELS } from '@/lib/status';
import { signOut } from '@/app/login/actions';

export default function QuestionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b pb-4">
        <Link href="/questions" className="font-bold">
          بنك الأسئلة
        </Link>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <Link key={key} href={`/questions?status=${key}`} className="text-sm text-blue-800 hover:underline">
            {label}
          </Link>
        ))}
        <Link href="/questions/new" className="ms-auto rounded bg-emerald-700 px-3 py-1.5 text-white">
          سؤال جديد
        </Link>
        <form action={signOut}>
          <button className="text-sm text-gray-600 hover:underline">خروج</button>
        </form>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **الخطوة 2: الجدول**

`admin/src/app/questions/page.tsx`:

```tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABELS, isQuestionStatus, type QuestionStatus } from '@/lib/status';
import { DIFFICULTY_LABELS, type Difficulty } from '@/lib/question-schema';

type ListRow = {
  id: string;
  prompt: string;
  status: QuestionStatus;
  difficulty: Difficulty;
  origin: 'human' | 'ai';
  categories: { name_ar: string } | null;
};

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('questions')
    .select('id, prompt, status, difficulty, origin, categories(name_ar)')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (status && isQuestionStatus(status)) query = query.eq('status', status);

  const { data, error } = await query.returns<ListRow[]>();
  if (error) return <p className="text-red-700">{error.message}</p>;
  if (!data || data.length === 0) return <p className="text-gray-600">لا توجد أسئلة في هذه القائمة.</p>;

  return (
    <table className="w-full border-collapse bg-white text-sm">
      <thead>
        <tr className="border-b">
          <th className="p-2 text-start">السؤال</th>
          <th className="p-2 text-start">التصنيف</th>
          <th className="p-2 text-start">المستوى</th>
          <th className="p-2 text-start">الحالة</th>
        </tr>
      </thead>
      <tbody>
        {data.map((q) => (
          <tr key={q.id} className="border-b hover:bg-gray-50">
            <td className="p-2">
              <Link href={`/questions/${q.id}`} className="text-blue-800 hover:underline">
                {q.prompt}
              </Link>
              {q.origin === 'ai' && <span className="ms-2 rounded bg-amber-100 px-1.5 text-xs text-amber-900">آلي</span>}
            </td>
            <td className="p-2">{q.categories?.name_ar}</td>
            <td className="p-2">{DIFFICULTY_LABELS[q.difficulty]}</td>
            <td className="p-2">{STATUS_LABELS[q.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **الخطوة 3: فحص الأنواع**

```bash
npx tsc --noEmit
```

المتوقع: لا أخطاء. وقد تظهر أخطاء تخص ملفات لم تُنشأ بعد إن وُجدت روابط إليها؛ الروابط هنا إلى صفحات فقط، فلا أخطاء.

- [ ] **الخطوة 4: Commit**

```bash
git add src/app/questions
git commit -m "feat(admin): question list filtered by status"
```

---

### المهمة 11: إنشاء الأسئلة وتعديلها

**الملفات:**
- إنشاء: `admin/src/app/questions/actions.ts`، `admin/src/components/QuestionForm.tsx`، `admin/src/app/questions/new/page.tsx`

- [ ] **الخطوة 1: إجراءات الخادم**

`admin/src/app/questions/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseQuestionForm, toRow } from '@/lib/question-schema';
import { readMediaFields, validateMedia, type Placement } from '@/lib/media';
import { isQuestionStatus } from '@/lib/status';

export type FormState = { errors: string[] } | null;

const PLACEMENTS: Placement[] = ['question', 'answer'];

export async function saveQuestion(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const parsed = parseQuestionForm(fd);
  const errors = parsed.success ? [] : parsed.error.issues.map((i) => i.message);

  const { data: domains } = await supabase.from('allowed_media_domains').select('domain');
  const allowed = (domains ?? []).map((d) => d.domain as string);
  const media = PLACEMENTS.map((placement) => ({ placement, input: readMediaFields(fd, placement) }));
  for (const m of media) if (m.input) errors.push(...validateMedia(m.input, allowed));

  if (!parsed.success || errors.length > 0) return { errors };

  let questionId = id;
  if (questionId) {
    const { data, error } = await supabase.from('questions').update(toRow(parsed.data)).eq('id', questionId).select('id');
    if (error) return { errors: [error.message] };
    if (!data || data.length === 0) return { errors: ['لا تملك صلاحية تعديل هذا السؤال في حالته الحالية'] };
  } else {
    const { data, error } = await supabase.from('questions').insert(toRow(parsed.data)).select('id').single();
    if (error) return { errors: [error.message] };
    questionId = data.id as string;
  }

  for (const { placement, input } of media) {
    const { error } = input
      ? await supabase.from('question_media').upsert(
          {
            question_id: questionId,
            placement,
            kind: input.kind,
            url: input.url,
            start_seconds: input.startSeconds,
            end_seconds: input.endSeconds,
            alt_text: input.altText,
          },
          { onConflict: 'question_id,placement' },
        )
      : await supabase.from('question_media').delete().eq('question_id', questionId).eq('placement', placement);
    if (error) return { errors: [error.message] };
  }

  revalidatePath('/questions');
  redirect(`/questions/${questionId}`);
}

export async function transitionQuestion(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const target = String(fd.get('target') ?? '');
  if (!isQuestionStatus(target)) return { errors: ['حالة غير معروفة'] };

  const supabase = await createClient();
  const notes = String(fd.get('notes') ?? '').trim();
  const { error } = await supabase.rpc('transition_question', { q_id: id, target, notes: notes || null });
  if (error) return { errors: [error.message] };

  revalidatePath('/questions');
  revalidatePath(`/questions/${id}`);
  return null;
}
```

- [ ] **الخطوة 2: نموذج السؤال**

النموذج يُرسَل عبر `startTransition` بدل خاصية `action`، لأن React 19 يمسح حقول النموذج بعد كل إرسال، فيضيع ما كتبه الكاتب إن ظهر خطأ.

`admin/src/components/QuestionForm.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import type { FormState } from '@/app/questions/actions';
import { TYPE_LABELS, DIFFICULTY_LABELS, type QuestionRow } from '@/lib/question-schema';
import type { Placement } from '@/lib/media';

const inputCls = 'w-full rounded border border-gray-300 bg-white p-2';

type Category = { id: number; name_ar: string };

export type MediaDefaults = {
  kind: 'image' | 'video';
  url: string;
  start_seconds: number | null;
  end_seconds: number | null;
  alt_text: string;
};

export type QuestionDefaults = QuestionRow & {
  media: { question: MediaDefaults | null; answer: MediaDefaults | null };
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function MediaFields({ placement, title, d }: { placement: Placement; title: string; d: MediaDefaults | null }) {
  const p = `${placement}_media_`;
  return (
    <fieldset className="space-y-2 rounded border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        <select name={`${p}kind`} defaultValue={d?.kind ?? 'video'} className={inputCls}>
          <option value="video">فيديو</option>
          <option value="image">صورة</option>
        </select>
        <input name={`${p}url`} defaultValue={d?.url ?? ''} placeholder="رابط https (اتركه فارغًا إن لم يوجد)" dir="ltr" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name={`${p}start`} type="number" min={0} defaultValue={d?.start_seconds ?? ''} placeholder="بداية اللقطة (ثانية)" className={inputCls} />
        <input name={`${p}end`} type="number" min={1} defaultValue={d?.end_seconds ?? ''} placeholder="نهاية اللقطة (ثانية)" className={inputCls} />
      </div>
      <input name={`${p}alt`} defaultValue={d?.alt_text ?? ''} placeholder="وصف نصي بديل يُعرض إن تعذّر التحميل" className={inputCls} />
    </fieldset>
  );
}

export function QuestionForm({
  categories,
  action,
  defaults,
}: {
  categories: Category[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: QuestionDefaults;
}) {
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>(defaults?.type ?? 'mcq');
  const options = defaults?.options ?? [];
  const correct = defaults?.correct_answer ?? null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setState(await action(null, fd)));
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-4">
      {state?.errors.length ? (
        <ul className="list-disc space-y-1 rounded border border-red-300 bg-red-50 p-3 ps-8 text-red-800">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      <Field label="نص السؤال">
        <textarea name="prompt" rows={3} required defaultValue={defaults?.prompt} className={inputCls} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="النوع">
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {Object.entries(TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="التصنيف">
          <select name="categoryId" required defaultValue={defaults?.category_id ?? ''} className={inputCls}>
            <option value="" disabled>
              اختر
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المستوى">
          <select name="difficulty" defaultValue={defaults?.difficulty ?? 'beginner'} className={inputCls}>
            {Object.entries(DIFFICULTY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {type === 'true_false' ? (
        <Field label="الإجابة الصحيحة">
          <select name="correct" defaultValue={correct === false ? 'false' : 'true'} className={inputCls}>
            <option value="true">صواب</option>
            <option value="false">خطأ</option>
          </select>
        </Field>
      ) : type === 'ordering' ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">العناصر بترتيبها الصحيح (من 3 إلى 6)</legend>
          {Array.from({ length: 6 }, (_, i) => (
            <input key={i} name="option" defaultValue={options[i] ?? ''} placeholder={`العنصر ${i + 1}`} className={inputCls} />
          ))}
        </fieldset>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">الخيارات (حدّد الصحيح)</legend>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" value={i} defaultChecked={correct === i} aria-label={`الخيار ${i + 1} هو الصحيح`} />
              <input name="option" defaultValue={options[i] ?? ''} placeholder={`الخيار ${i + 1}`} className={inputCls} />
            </div>
          ))}
        </fieldset>
      )}

      <Field label="الفائدة (تظهر بعد الإجابة)">
        <textarea name="benefit" rows={2} required defaultValue={defaults?.benefit} className={inputCls} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="المصدر">
          <input name="sourceBook" required defaultValue={defaults?.source_book} className={inputCls} />
        </Field>
        <Field label="الجزء">
          <input name="sourceVolume" defaultValue={defaults?.source_volume ?? ''} className={inputCls} />
        </Field>
        <Field label="الصفحة">
          <input name="sourcePage" required defaultValue={defaults?.source_page} className={inputCls} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="رقم السورة">
          <input name="surah" type="number" min={1} max={114} defaultValue={defaults?.surah ?? ''} className={inputCls} />
        </Field>
        <Field label="رقم الآية">
          <input name="ayah" type="number" min={1} defaultValue={defaults?.ayah ?? ''} className={inputCls} />
        </Field>
      </div>

      <MediaFields placement="question" title="وسيط مع السؤال" d={defaults?.media.question ?? null} />
      <MediaFields placement="answer" title="شرح مرئي مع الإجابة" d={defaults?.media.answer ?? null} />

      <button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'جارٍ الحفظ…' : 'حفظ'}
      </button>
    </form>
  );
}
```

- [ ] **الخطوة 3: صفحة السؤال الجديد**

`admin/src/app/questions/new/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { QuestionForm } from '@/components/QuestionForm';
import { saveQuestion } from '../actions';

export default async function NewQuestionPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from('categories').select('id, name_ar').order('id');
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">سؤال جديد</h1>
      <QuestionForm categories={categories ?? []} action={saveQuestion.bind(null, null)} />
    </>
  );
}
```

- [ ] **الخطوة 4: فحص الأنواع والاختبارات**

```bash
npx tsc --noEmit && npm test
```

المتوقع: لا أخطاء أنواع، وكل الاختبارات تنجح.

- [ ] **الخطوة 5: Commit**

```bash
git add src
git commit -m "feat(admin): create and edit questions with media"
```

---

### المهمة 12: صفحة السؤال، والمعاينة، ومسار المراجعة

**الملفات:**
- إنشاء: `admin/src/components/MediaPreview.tsx`، `admin/src/components/TransitionPanel.tsx`، `admin/src/app/questions/[id]/page.tsx`

- [ ] **الخطوة 1: معاينة الوسيط**

`admin/src/components/MediaPreview.tsx`:

```tsx
import { parseYouTubeId, youTubeEmbedUrl, type MediaKind } from '@/lib/media';

export function MediaPreview({
  kind,
  url,
  start,
  end,
  alt,
}: {
  kind: MediaKind;
  url: string;
  start: number | null;
  end: number | null;
  alt: string;
}) {
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className="max-h-80 rounded border" />;
  }
  const id = parseYouTubeId(url);
  if (id) {
    return (
      <iframe
        src={youTubeEmbedUrl(id, start, end)}
        title={alt}
        allow="encrypted-media"
        allowFullScreen
        className="aspect-video w-full max-w-xl rounded border"
      />
    );
  }
  return <video src={url} controls aria-label={alt} className="w-full max-w-xl rounded border" />;
}
```

- [ ] **الخطوة 2: لوحة أزرار المراجعة**

`admin/src/components/TransitionPanel.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { transitionQuestion } from '@/app/questions/actions';
import { ACTION_LABELS, type QuestionStatus } from '@/lib/status';

export function TransitionPanel({ id, targets }: { id: string; targets: QuestionStatus[] }) {
  const [state, formAction, pending] = useActionState(transitionQuestion.bind(null, id), null);
  if (targets.length === 0) return null;

  return (
    <form action={formAction} className="space-y-2 rounded border bg-white p-4">
      {state?.errors.length ? <p className="text-sm text-red-700">{state.errors.join('، ')}</p> : null}
      {targets.includes('approved') && (
        <p className="text-sm text-gray-600">راجِع نص السؤال ومصدره وشاهد الوسائط أعلاه قبل الاعتماد.</p>
      )}
      {targets.includes('needs_changes') && (
        <textarea name="notes" rows={2} placeholder="ملاحظات المراجعة (مطلوبة عند الإعادة للتعديل)" className="w-full rounded border p-2" />
      )}
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button
            key={t}
            name="target"
            value={t}
            disabled={pending}
            className="rounded border border-gray-400 px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50"
          >
            {ACTION_LABELS[t]}
          </button>
        ))}
      </div>
    </form>
  );
}
```

- [ ] **الخطوة 3: صفحة السؤال**

`admin/src/app/questions/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QuestionForm, type MediaDefaults } from '@/components/QuestionForm';
import { MediaPreview } from '@/components/MediaPreview';
import { TransitionPanel } from '@/components/TransitionPanel';
import { STATUS_LABELS, availableTransitions, canEdit, type QuestionStatus, type Role } from '@/lib/status';
import { TYPE_LABELS, DIFFICULTY_LABELS, type QuestionRow } from '@/lib/question-schema';
import type { Placement } from '@/lib/media';
import { saveQuestion } from '../actions';

type MediaRow = MediaDefaults & { placement: Placement };

function QuestionSummary({ q }: { q: QuestionRow }) {
  return (
    <dl className="grid gap-2 rounded border bg-white p-4 sm:grid-cols-[10rem_1fr]">
      <dt className="font-medium">النوع والمستوى</dt>
      <dd>
        {TYPE_LABELS[q.type]} · {DIFFICULTY_LABELS[q.difficulty]}
      </dd>
      {q.options && (
        <>
          <dt className="font-medium">{q.type === 'ordering' ? 'الترتيب الصحيح' : 'الخيارات'}</dt>
          <dd>
            <ol className="list-decimal ps-5">
              {q.options.map((o, i) => (
                <li key={i} className={q.correct_answer === i ? 'font-bold text-emerald-800' : ''}>
                  {o}
                </li>
              ))}
            </ol>
          </dd>
        </>
      )}
      {q.type === 'true_false' && (
        <>
          <dt className="font-medium">الإجابة</dt>
          <dd>{q.correct_answer ? 'صواب' : 'خطأ'}</dd>
        </>
      )}
      <dt className="font-medium">الفائدة</dt>
      <dd>{q.benefit}</dd>
      <dt className="font-medium">المصدر</dt>
      <dd>{[q.source_book, q.source_volume, q.source_page].filter(Boolean).join(' / ')}</dd>
      {q.surah !== null && (
        <>
          <dt className="font-medium">الآية</dt>
          <dd>
            {q.surah}:{q.ayah}
          </dd>
        </>
      )}
    </dl>
  );
}

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: q }, { data: media }, { data: categories }, { data: profile }] = await Promise.all([
    supabase.from('questions').select('*').eq('id', id).maybeSingle<QuestionRow>(),
    supabase.from('question_media').select('placement, kind, url, start_seconds, end_seconds, alt_text').eq('question_id', id).returns<MediaRow[]>(),
    supabase.from('categories').select('id, name_ar').order('id'),
    supabase.from('profiles').select('role').eq('id', user.id).single<{ role: Role }>(),
  ]);
  if (!q) notFound();

  const role: Role = profile?.role ?? 'writer';
  const status = q.status as QuestionStatus;
  const isAuthor = q.author_id === user.id;
  const pick = (p: Placement): MediaDefaults | null => (media ?? []).find((m) => m.placement === p) ?? null;
  const placements: Placement[] = ['question', 'answer'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{q.prompt}</h1>
        <span className="rounded bg-gray-200 px-2 py-0.5 text-sm">{STATUS_LABELS[status]}</span>
        {q.origin === 'ai' && <span className="rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-900">مولَّد آليًا</span>}
      </div>

      {q.review_notes && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3">ملاحظات المراجع: {q.review_notes}</p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {placements.map((p) => {
          const m = pick(p);
          return m ? (
            <div key={p} className="space-y-1">
              <h2 className="text-sm font-medium">{p === 'question' ? 'وسيط السؤال' : 'شرح الإجابة'}</h2>
              <MediaPreview kind={m.kind} url={m.url} start={m.start_seconds} end={m.end_seconds} alt={m.alt_text} />
            </div>
          ) : null;
        })}
      </section>

      <TransitionPanel id={id} targets={availableTransitions(status, role, isAuthor)} />

      {canEdit(status, role, isAuthor) ? (
        <QuestionForm
          categories={categories ?? []}
          action={saveQuestion.bind(null, id)}
          defaults={{ ...q, media: { question: pick('question'), answer: pick('answer') } }}
        />
      ) : (
        <QuestionSummary q={q} />
      )}
    </div>
  );
}
```

- [ ] **الخطوة 4: فحص الأنواع والبناء**

```bash
npx tsc --noEmit && npm test && npm run build
```

المتوقع: لا أخطاء، وكل الاختبارات تنجح، والبناء يكتمل.

- [ ] **الخطوة 5: Commit**

```bash
git add src
git commit -m "feat(admin): question page with media preview and review actions"
```

---

### المهمة 13: تجربة المسار كاملًا يدويًا

- [ ] **الخطوة 1: إنشاء ثلاثة حسابات**

افتح Studio (http://localhost:54323)، ثم Authentication، ثم Add user، وأنشئ ثلاثة مستخدمين بكلمات مرور مع تفعيل «Auto Confirm User»:
`writer@local.test` و`reviewer@local.test` و`admin@local.test`.

- [ ] **الخطوة 2: ترقية الأدوار**

في SQL Editor داخل Studio:

```sql
update public.profiles set role = 'reviewer'
where id = (select id from auth.users where email = 'reviewer@local.test');
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'admin@local.test');
```

- [ ] **الخطوة 3: تنفيذ القائمة التالية والتأكد من كل بند**

```bash
cd admin && npm run dev
```

1. بحساب الكاتب: أنشئ سؤال اختيار من متعدد بخيار فارغ. المتوقع: «أدخل أربعة خيارات غير فارغة»، مع بقاء ما كتبته في الحقول.
2. أكمِل الخيارات، وأضف شرحًا مرئيًا برابط يوتيوب، ووقت بداية 10 ونهاية 40. المتوقع: يُحفظ وتنتقل إلى صفحة السؤال، وتظهر المعاينة.
3. جرّب رابطًا من `https://example.com/x.mp4`. المتوقع: «الرابط ليس من المواقع المسموح بها أو لا يبدأ بـ https».
4. اضغط «إرسال للمراجعة». المتوقع: الحالة «قيد المراجعة»، ويختفي النموذج ويظهر الملخص.
5. بحساب المراجع: اضغط «إعادة للتعديل» دون ملاحظات. المتوقع: «ملاحظات المراجعة مطلوبة عند الإعادة للتعديل».
6. أعِده مع ملاحظة. ثم بحساب الكاتب: تأكد من ظهور الملاحظة، وعدّل، وأعد الإرسال.
7. بحساب المراجع: اضغط «اعتماد». المتوقع: الحالة «معتمد».
8. بحساب المدير: اضغط «نشر»، ثم «إيقاف»، ثم «إرسال للمراجعة». المتوقع: كل انتقال يحدث كما هو موصوف.
9. بحساب المدير: أنشئ سؤالًا وأرسله للمراجعة. المتوقع: لا يظهر له زر «اعتماد» على سؤاله.

- [ ] **الخطوة 4: Commit الخطة**

```bash
cd ..
mkdir -p docs/superpowers/plans
git add docs
git commit -m "docs: question bank admin plan"
```

---

## المراجعة الذاتية

**تغطية التصميم:** بطاقة السؤال بحقولها كلها (المهام 2 و7 و11)، ومسار الحالات بفرعيه (المهمة 4)، والأدوار وفصل الكاتب عن المعتمِد حتى للمدير (المهام 3 و4 و8)، وعلامة «مولَّد آليًا» (عمود `origin` والشارة في المهمتين 10 و12)، والمعاينة قبل الاعتماد (المهمة 12)، والمواقع المسموح بها في القاعدة والواجهة (المهمتان 5 و6)، ووسيط السؤال المرئي إلزامي (المهمة 4)، والوصف النصي البديل إلزامي (المهمتان 2 و6)، وواجهة عربية من اليمين إلى اليسار (المهمة 9). وما لم يُغطَّ هنا مذكور في «خارج نطاق هذه الخطة» أعلاه.

**اتساق الأسماء:** `transition_question(q_id, target, notes)` تُستدعى بالأسماء نفسها في `actions.ts`. وحقول النموذج (`option` و`correct` و`<placement>_media_*`) واحدة في `QuestionForm` و`parseQuestionForm` و`readMediaFields`. ورسائل الخطأ العربية في الاختبارات مطابقة حرفيًا لما في الترحيلات والمكتبات.
