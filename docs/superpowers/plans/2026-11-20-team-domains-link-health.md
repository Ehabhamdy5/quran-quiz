# خطة تنفيذ: الفريق والمواقع المسموح بها وفحص الروابط (الخطة 2 من 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**الهدف:** يدير المدير حسابات الفريق وأدوارهم والمواقع المسموح بها من اللوحة نفسها، ويُفحص كل رابط وسيط يوميًا: السؤال المنشور الذي تعطّل رابطه يُوقف آليًا ويظهر في قائمة «تحتاج إصلاحًا».

**البنية:** على نهج الخطة 1، القاعدة هي الحَكَم. حقول صحة الرابط لا يكتبها إلا الفاحص عبر الدالة `record_link_check` المتاحة لمفتاح الخدمة وحده، وتغيير الأدوار يمر بالدالة `set_user_role` للمدير وحده. الفاحص سكربت Node يعمل يوميًا من GitHub Actions، ومنطقه في مكتبة مختبرة بـ Vitest بلا شبكة.

**التقنيات:** ما في الخطة 1، ويُضاف `tsx` لتشغيل السكربت، وGitHub Actions للجدولة.

**المرجع:** وثيقة التصميم «وثيقة تصميم منصة المسابقة القرآنية»: قسم «الضمانات» (الفحص اليومي وقائمة «تحتاج إصلاحًا»)، وجدول «الأدوار» (المدير يدير المواقع والحسابات). والخطة 1 في `docs/superpowers/plans/2026-11-20-question-bank-admin.md`.

**الخطط اللاحقة:** 3) التوليد المساعَد من كتب التفسير، 4) تطبيق اللاعب (Flutter) بما فيه زر البلاغ وإعادة معايرة الصعوبة، 5) التحدي المباشر.

**خارج نطاق هذه الخطة:** إعادة تعيين كلمات المرور وتعطيل الحسابات (يُدار من لوحة Supabase إلى حين)، وفحص روابط مواقع الفيديو غير يوتيوب بغير طلب HTTP مباشر.

---

## خريطة الملفات

```
quran-quiz/
├── .github/workflows/check-links.yml                 تشغيل الفاحص يوميًا
├── supabase/
│   ├── migrations/
│   │   ├── 20261120000500_media_health.sql           حقول صحة الرابط والدالة record_link_check
│   │   └── 20261120000600_team.sql                   الدالة set_user_role
│   └── tests/database/
│       ├── 05_media_health.test.sql
│       └── 06_team.test.sql
└── admin/
    ├── scripts/check-links.ts                        سكربت الفاحص
    └── src/
        ├── lib/
        │   ├── domains.ts (+ test)                   تطبيع اسم الموقع والتحقق منه
        │   ├── team.ts (+ test)                      أسماء الأدوار والتحقق من نموذج العضو الجديد
        │   ├── link-check.ts (+ test)                فحص رابط واحد وتشغيل الفحص على قائمة
        │   └── supabase/admin.ts                     عميل بمفتاح الخدمة (للخادم فقط)
        ├── components/AppHeader.tsx                  رأس مشترك فيه روابط المدير
        └── app/
            ├── questions/layout.tsx, page.tsx, [id]/page.tsx   (تعديل)
            └── settings/
                ├── layout.tsx                        للمدير فقط
                ├── domains/page.tsx, DomainForm.tsx, actions.ts
                └── team/page.tsx, RoleForm.tsx, MemberForm.tsx, actions.ts
```

---

### المهمة 1: حقول صحة الرابط في القاعدة

**الملفات:**
- إنشاء: `supabase/migrations/20261120000500_media_health.sql`
- اختبار: `supabase/tests/database/05_media_health.test.sql`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`supabase/tests/database/05_media_health.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';

-- التجهيز بصلاحية المالك: سؤال منشور بوسيط، ومسودة بوسيط.
insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page, author_id) values
  ('10000000-0000-0000-0000-000000000001', 'سؤال منشور', 'mcq', 1, 'beginner', '["أ","ب","ج","د"]', '0', 'فائدة', 'مصدر', '1', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000002', 'مسودة', 'mcq', 1, 'beginner', '["أ","ب","ج","د"]', '0', 'فائدة', 'مصدر', '1', '00000000-0000-0000-0000-00000000000a');
select set_config('app.in_transition', 'on', true);
update public.questions set status = 'published' where id = '10000000-0000-0000-0000-000000000001';
select set_config('app.in_transition', 'off', true);
insert into public.question_media (id, question_id, placement, kind, url, alt_text) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'answer', 'video', 'https://youtu.be/abcdefghijk', 'شرح'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'answer', 'video', 'https://youtu.be/abcdefghijk', 'شرح');

-- الكاتب
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.record_link_check('20000000-0000-0000-0000-000000000001', false, 'HTTP 404') $$,
  '42501', null, 'staff cannot record link checks'
);
update public.question_media set broken_at = now() where id = '20000000-0000-0000-0000-000000000002';
select is(
  (select broken_at from public.question_media where id = '20000000-0000-0000-0000-000000000002'),
  null, 'staff cannot mark a link broken by hand'
);

-- الفاحص
reset role;
set local role service_role;
select is(
  public.record_link_check('20000000-0000-0000-0000-000000000001', false, 'HTTP 404'),
  true, 'a broken link suspends its published question'
);
reset role;
select is((select status::text from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'suspended', 'the question is suspended');
select is((select review_notes from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'أُوقف آليًا لأن رابط الوسيط معطل: HTTP 404', 'the suspension explains itself');
select ok((select broken_at is not null and check_error = 'HTTP 404'
  from public.question_media where id = '20000000-0000-0000-0000-000000000001'), 'the media is marked broken');

set local role service_role;
select public.record_link_check('20000000-0000-0000-0000-000000000001', true);
reset role;
select ok((select broken_at is null and check_error is null and checked_at is not null
  from public.question_media where id = '20000000-0000-0000-0000-000000000001'), 'a passing check clears the mark');

-- المدير يصلح الرابط: تغييره يمحو الحكم القديم.
set local role service_role;
select public.record_link_check('20000000-0000-0000-0000-000000000001', false, 'HTTP 404');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
update public.question_media set url = 'https://www.youtube.com/watch?v=bcdefghijkl'
where id = '20000000-0000-0000-0000-000000000001';
reset role;
select ok((select broken_at is null and checked_at is null
  from public.question_media where id = '20000000-0000-0000-0000-000000000001'), 'a new url clears the old verdict');

select * from finish();
rollback;
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npx supabase test db
```

المتوقع: FAIL في `05_media_health.test.sql`، والسبب `function public.record_link_check(...) does not exist`.

- [ ] **الخطوة 3: كتابة الترحيل**

`supabase/migrations/20261120000500_media_health.sql`:

```sql
alter table public.question_media
  add column checked_at timestamptz,
  add column broken_at timestamptz,
  add column check_error text;

create index question_media_broken_idx on public.question_media (question_id) where broken_at is not null;

-- حقول الفحص لا يكتبها إلا الفاحص، وتغيير الرابط يمحو حكمه القديم.
create function public.guard_media_health() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.in_link_check', true), '') <> 'on' then
    if tg_op = 'INSERT' or new.url is distinct from old.url then
      new.checked_at := null;
      new.broken_at := null;
      new.check_error := null;
    else
      new.checked_at := old.checked_at;
      new.broken_at := old.broken_at;
      new.check_error := old.check_error;
    end if;
  end if;
  return new;
end $$;

create trigger question_media_guard_health
before insert or update on public.question_media
for each row execute function public.guard_media_health();

-- يُرجع true إذا أوقف سؤالًا منشورًا.
create function public.record_link_check(m_id uuid, ok boolean, err text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  q_id uuid;
  reason text := coalesce(nullif(trim(err), ''), 'تعذّر الوصول');
  suspended boolean := false;
begin
  perform set_config('app.in_link_check', 'on', true);
  update public.question_media set
    checked_at = now(),
    broken_at = case when ok then null else coalesce(broken_at, now()) end,
    check_error = case when ok then null else reason end
  where id = m_id
  returning question_id into q_id;
  perform set_config('app.in_link_check', 'off', true);

  if q_id is null then
    raise exception 'الوسيط غير موجود';
  end if;

  if not ok then
    perform set_config('app.in_transition', 'on', true);
    update public.questions set
      status = 'suspended',
      review_notes = 'أُوقف آليًا لأن رابط الوسيط معطل: ' || reason
    where id = q_id and status = 'published';
    suspended := found;
    perform set_config('app.in_transition', 'off', true);
  end if;
  return suspended;
end $$;

revoke execute on function public.record_link_check(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.record_link_check(uuid, boolean, text) to service_role;
```

- [ ] **الخطوة 4: التطبيق والاختبار**

```bash
npx supabase db reset
npx supabase test db
```

المتوقع: `All tests successful` للملفات الخمسة.

- [ ] **الخطوة 5: Commit**

```bash
git add supabase
git commit -m "feat(db): media link health and automatic suspension"
```

---

### المهمة 2: تغيير الأدوار في القاعدة

**الملفات:**
- إنشاء: `supabase/migrations/20261120000600_team.sql`
- اختبار: `supabase/tests/database/06_team.test.sql`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`supabase/tests/database/06_team.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.set_user_role('00000000-0000-0000-0000-00000000000a', 'admin') $$,
  'P0001', 'إدارة الفريق للمدير فقط', 'a writer cannot change roles'
);
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'writer', 'a writer cannot promote themselves directly');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ select public.set_user_role('00000000-0000-0000-0000-00000000000a', 'reviewer') $$,
  'an admin changes a role'
);
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'reviewer', 'the new role is stored');
select throws_ok(
  $$ select public.set_user_role('00000000-0000-0000-0000-00000000000c', 'writer') $$,
  'P0001', 'لا يغيّر المدير دوره بنفسه', 'an admin cannot demote themselves'
);

select * from finish();
rollback;
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npx supabase test db
```

المتوقع: FAIL في `06_team.test.sql`، والسبب `function public.set_user_role(...) does not exist`.

- [ ] **الخطوة 3: كتابة الترحيل**

`supabase/migrations/20261120000600_team.sql`:

```sql
create function public.set_user_role(target uuid, new_role public.user_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'إدارة الفريق للمدير فقط';
  end if;
  -- يمنع أن يبقى الفريق بلا مدير بخطأ من المدير نفسه.
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'لا يغيّر المدير دوره بنفسه';
  end if;
  update public.profiles set role = new_role where id = target;
  if not found then
    raise exception 'المستخدم غير موجود';
  end if;
end $$;

revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
```

- [ ] **الخطوة 4: التطبيق والاختبار**

```bash
npx supabase db reset
npx supabase test db
```

المتوقع: `All tests successful` للملفات الستة.

- [ ] **الخطوة 5: Commit**

```bash
git add supabase
git commit -m "feat(db): admin-only role changes"
```

---

### المهمة 3: مكتبة المواقع

**الملفات:**
- إنشاء: `admin/src/lib/domains.ts`
- اختبار: `admin/src/lib/domains.test.ts`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`admin/src/lib/domains.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeDomain } from './domains';

describe('normalizeDomain', () => {
  it.each([
    ['YouTube.com', 'youtube.com'],
    ['  tafsir.net ', 'tafsir.net'],
    ['https://www.tafsir.net/videos/1', 'tafsir.net'],
    ['www.tafsir.net', 'tafsir.net'],
    ['cdn.tafsir.net/', 'cdn.tafsir.net'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each([[''], ['not a domain'], ['localhost'], ['http://x'], ['-bad-.com']])('rejects %j', (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
cd admin && npm test -- src/lib/domains.test.ts
```

المتوقع: FAIL، والسبب `Cannot find module './domains'`.

- [ ] **الخطوة 3: كتابة التنفيذ**

`admin/src/lib/domains.ts`:

```ts
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// يقبل اسم الموقع أو رابطًا كاملًا، ويُرجع النطاق بحروف صغيرة دون www، أو null.
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.includes('://')) {
    try {
      s = new URL(s).hostname;
    } catch {
      return null;
    }
  }
  s = s.replace(/\/.*$/, '').replace(/\.$/, '').replace(/^www\./, '');
  return HOST.test(s) ? s : null;
}
```

- [ ] **الخطوة 4: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test -- src/lib/domains.test.ts
```

المتوقع: PASS.

- [ ] **الخطوة 5: Commit**

```bash
git add src/lib/domains.ts src/lib/domains.test.ts
git commit -m "feat(admin): allowed domain normalisation"
```

---

### المهمة 4: مكتبة الفريق

**الملفات:**
- إنشاء: `admin/src/lib/team.ts`
- اختبار: `admin/src/lib/team.test.ts`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`admin/src/lib/team.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseNewMember, isRole } from './team';

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const valid = { email: ' New@Tafsir.net ', displayName: 'أحمد', password: 'a-long-password', role: 'reviewer' };

describe('parseNewMember', () => {
  it('accepts a complete member and normalises the email', () => {
    const r = parseNewMember(form(valid));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ ...valid, email: 'new@tafsir.net' });
  });

  it('reports each missing or weak field', () => {
    const r = parseNewMember(form({ email: 'no', displayName: ' ', password: 'short', role: 'owner' }));
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining(['بريد إلكتروني غير صالح', 'الاسم مطلوب', 'كلمة المرور 10 أحرف على الأقل', 'اختر الدور']),
    );
  });
});

describe('isRole', () => {
  it('recognises the three roles only', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('owner')).toBe(false);
  });
});
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npm test -- src/lib/team.test.ts
```

المتوقع: FAIL، والسبب `Cannot find module './team'`.

- [ ] **الخطوة 3: كتابة التنفيذ**

`admin/src/lib/team.ts`:

```ts
import { z } from 'zod';
import type { Role } from './status';

export const ROLE_LABELS: Record<Role, string> = {
  writer: 'كاتب',
  reviewer: 'مراجع علمي',
  admin: 'مدير',
};

export function isRole(value: string): value is Role {
  return Object.hasOwn(ROLE_LABELS, value);
}

export const newMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('بريد إلكتروني غير صالح'),
  displayName: z.string().trim().min(1, 'الاسم مطلوب'),
  password: z.string().min(10, 'كلمة المرور 10 أحرف على الأقل'),
  role: z.enum(['writer', 'reviewer', 'admin'], { errorMap: () => ({ message: 'اختر الدور' }) }),
});

export function parseNewMember(fd: FormData) {
  const text = (key: string) => String(fd.get(key) ?? '');
  return newMemberSchema.safeParse({
    email: text('email'),
    displayName: text('displayName'),
    password: text('password'),
    role: text('role'),
  });
}
```

- [ ] **الخطوة 4: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test -- src/lib/team.test.ts
```

المتوقع: PASS.

- [ ] **الخطوة 5: Commit**

```bash
git add src/lib/team.ts src/lib/team.test.ts
git commit -m "feat(admin): team roles and new member validation"
```

---

### المهمة 5: منطق فحص الروابط

يوتيوب يُفحص عبر oEmbed: يُرجع 200 للفيديو المتاح، و401 أو 403 للخاص أو الممنوع من التضمين، و400 أو 404 للمحذوف. والروابط الأخرى بطلب HEAD (أو GET لبايت واحد إن رُفض HEAD). وأي نتيجة غير حاسمة (انقطاع شبكة، 5xx، 429) تُعدّ «غير معروفة» ولا تُسجَّل، حتى لا يوقف عطل عابر سؤالًا سليمًا.

**الملفات:**
- إنشاء: `admin/src/lib/link-check.ts`
- اختبار: `admin/src/lib/link-check.test.ts`

- [ ] **الخطوة 1: كتابة الاختبار الفاشل**

`admin/src/lib/link-check.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkMediaUrl, runLinkCheck } from './link-check';

const ID = 'abcdefghijk';

function fakeFetch(statusFor: (url: string, method: string) => number | Error) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    const s = statusFor(url, method);
    if (s instanceof Error) throw s;
    return new Response(null, { status: s });
  }) as typeof fetch;
  return { impl, calls };
}

describe('checkMediaUrl', () => {
  it('asks YouTube oEmbed about YouTube links', async () => {
    const f = fakeFetch(() => 200);
    expect(await checkMediaUrl(`https://youtu.be/${ID}`, f.impl)).toEqual({ status: 'ok' });
    expect(f.calls[0]).toContain('https://www.youtube.com/oembed?format=json&url=');
    expect(f.calls[0]).toContain(encodeURIComponent(`https://www.youtube.com/watch?v=${ID}`));
  });

  it('reports removed and private YouTube videos as broken', async () => {
    expect(await checkMediaUrl(`https://youtu.be/${ID}`, fakeFetch(() => 404).impl)).toEqual({
      status: 'broken',
      error: 'الفيديو غير موجود على يوتيوب',
    });
    expect(await checkMediaUrl(`https://youtu.be/${ID}`, fakeFetch(() => 401).impl)).toEqual({
      status: 'broken',
      error: 'الفيديو خاص أو يمنع التضمين',
    });
  });

  it('checks other links with HEAD, falling back to GET', async () => {
    expect(await checkMediaUrl('https://cdn.tafsir.net/a.png', fakeFetch(() => 200).impl)).toEqual({ status: 'ok' });
    const f = fakeFetch((_, method) => (method === 'HEAD' ? 405 : 206));
    expect(await checkMediaUrl('https://cdn.tafsir.net/a.mp4', f.impl)).toEqual({ status: 'ok' });
    expect(f.calls).toEqual(['HEAD https://cdn.tafsir.net/a.mp4', 'GET https://cdn.tafsir.net/a.mp4']);
  });

  it('treats 404 as broken but server errors and network failures as unknown', async () => {
    expect(await checkMediaUrl('https://cdn.tafsir.net/a.png', fakeFetch(() => 404).impl)).toEqual({
      status: 'broken',
      error: 'HTTP 404',
    });
    expect((await checkMediaUrl('https://cdn.tafsir.net/a.png', fakeFetch(() => 503).impl)).status).toBe('unknown');
    expect((await checkMediaUrl('https://cdn.tafsir.net/a.png', fakeFetch(() => new Error('timeout')).impl)).status).toBe(
      'unknown',
    );
  });
});

describe('runLinkCheck', () => {
  it('records decisive results only and counts suspensions', async () => {
    const recorded: string[] = [];
    const media = [
      { id: 'm1', url: 'https://cdn.tafsir.net/ok.png' },
      { id: 'm2', url: 'https://cdn.tafsir.net/gone.png' },
      { id: 'm3', url: 'https://cdn.tafsir.net/flaky.png' },
    ];
    const f = fakeFetch((url) => (url.includes('ok') ? 200 : url.includes('gone') ? 404 : 503));
    const summary = await runLinkCheck(
      media,
      async (id, ok, error) => {
        recorded.push(`${id}:${ok}:${error}`);
        return !ok;
      },
      f.impl,
    );
    expect(recorded.sort()).toEqual(['m1:true:null', 'm2:false:HTTP 404']);
    expect(summary).toEqual({ checked: 3, ok: 1, broken: 1, unknown: 1, suspended: 1, failures: [] });
  });

  it('keeps going when recording one result fails', async () => {
    const summary = await runLinkCheck(
      [{ id: 'm1', url: 'https://cdn.tafsir.net/a.png' }],
      async () => {
        throw new Error('db down');
      },
      fakeFetch(() => 200).impl,
    );
    expect(summary.failures).toEqual(['m1: db down']);
  });
});
```

- [ ] **الخطوة 2: تشغيله والتأكد من فشله**

```bash
npm test -- src/lib/link-check.test.ts
```

المتوقع: FAIL، والسبب `Cannot find module './link-check'`.

- [ ] **الخطوة 3: كتابة التنفيذ**

`admin/src/lib/link-check.ts`:

```ts
import { parseYouTubeId } from './media';

export type CheckResult = { status: 'ok' } | { status: 'broken' | 'unknown'; error: string };

export type CheckSummary = {
  checked: number;
  ok: number;
  broken: number;
  unknown: number;
  suspended: number;
  failures: string[];
};

const TIMEOUT_MS = 15_000;

function request(fetchImpl: typeof fetch, url: string, method: 'HEAD' | 'GET', range = false) {
  return fetchImpl(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: range ? { Range: 'bytes=0-0' } : undefined,
  });
}

export async function checkMediaUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<CheckResult> {
  try {
    const id = parseYouTubeId(url);
    if (id) {
      const watch = `https://www.youtube.com/watch?v=${id}`;
      const res = await request(fetchImpl, `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, 'GET');
      if (res.ok) return { status: 'ok' };
      if (res.status === 401 || res.status === 403) return { status: 'broken', error: 'الفيديو خاص أو يمنع التضمين' };
      if (res.status === 400 || res.status === 404) return { status: 'broken', error: 'الفيديو غير موجود على يوتيوب' };
      return { status: 'unknown', error: `HTTP ${res.status}` };
    }

    let res = await request(fetchImpl, url, 'HEAD');
    if (res.status === 405 || res.status === 501) res = await request(fetchImpl, url, 'GET', true);
    if (res.ok) return { status: 'ok' };
    if ([401, 403, 404, 410].includes(res.status)) return { status: 'broken', error: `HTTP ${res.status}` };
    return { status: 'unknown', error: `HTTP ${res.status}` };
  } catch (e) {
    return { status: 'unknown', error: e instanceof Error ? e.message : String(e) };
  }
}

// record يُرجع true إذا أُوقف سؤال بسبب النتيجة.
export async function runLinkCheck(
  media: { id: string; url: string }[],
  record: (id: string, ok: boolean, error: string | null) => Promise<boolean>,
  fetchImpl: typeof fetch = fetch,
  concurrency = 4,
): Promise<CheckSummary> {
  const summary: CheckSummary = { checked: 0, ok: 0, broken: 0, unknown: 0, suspended: 0, failures: [] };
  const queue = [...media];

  async function worker() {
    for (let m = queue.shift(); m; m = queue.shift()) {
      const result = await checkMediaUrl(m.url, fetchImpl);
      summary.checked++;
      summary[result.status]++;
      if (result.status === 'unknown') continue;
      try {
        const ok = result.status === 'ok';
        if (await record(m.id, ok, ok ? null : result.error)) summary.suspended++;
      } catch (e) {
        summary.failures.push(`${m.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, media.length) }, worker));
  return summary;
}
```

- [ ] **الخطوة 4: تشغيل الاختبار والتأكد من نجاحه**

```bash
npm test
```

المتوقع: PASS لكل ملفات الاختبار.

- [ ] **الخطوة 5: Commit**

```bash
git add src/lib/link-check.ts src/lib/link-check.test.ts
git commit -m "feat(admin): media link checking logic"
```

---

### المهمة 6: سكربت الفاحص وجدولته

**الملفات:**
- إنشاء: `admin/scripts/check-links.ts`، `.github/workflows/check-links.yml`
- تعديل: `admin/package.json`

- [ ] **الخطوة 1: تثبيت tsx وإضافة الأمر**

```bash
npm install -D tsx
npm pkg set scripts.check-links="tsx scripts/check-links.ts"
```

- [ ] **الخطوة 2: السكربت**

`admin/scripts/check-links.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { runLinkCheck } from '../src/lib/link-check';

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('اضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: media, error } = await db.from('question_media').select('id, url');
  if (error) throw new Error(error.message);

  const summary = await runLinkCheck(media ?? [], async (id, ok, err) => {
    const { data, error: rpcError } = await db.rpc('record_link_check', { m_id: id, ok, err });
    if (rpcError) throw new Error(rpcError.message);
    return data === true;
  });

  console.log(JSON.stringify(summary));
  if (summary.failures.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **الخطوة 3: الجدولة اليومية**

`.github/workflows/check-links.yml`:

```yaml
name: check-links

on:
  schedule:
    - cron: '17 1 * * *'
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: admin
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: admin/package-lock.json
      - run: npm ci
      - name: Check media links
        run: |
          if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
            echo "Secrets not set yet; skipping."
            exit 0
          fi
          npm run check-links
```

- [ ] **الخطوة 4: التشغيل المحلي**

```bash
SUPABASE_SERVICE_ROLE_KEY=<service_role key> npx tsx --env-file=.env.local scripts/check-links.ts
```

المتوقع: سطر JSON فيه عدد الروابط المفحوصة، دون `failures`.

- [ ] **الخطوة 5: Commit**

```bash
cd ..
git add admin/scripts admin/package.json admin/package-lock.json .github
git commit -m "feat: daily media link checker"
```

---

### المهمة 7: الرأس المشترك وقائمة «تحتاج إصلاحًا»

**الملفات:**
- إنشاء: `admin/src/components/AppHeader.tsx`
- تعديل: `admin/src/app/questions/layout.tsx`، `admin/src/app/questions/page.tsx`، `admin/src/app/questions/[id]/page.tsx`

- [ ] **الخطوة 1: الرأس المشترك**

`admin/src/components/AppHeader.tsx`:

```tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABELS } from '@/lib/status';
import { signOut } from '@/app/login/actions';

const linkCls = 'text-sm text-blue-800 hover:underline';

export async function AppHeader() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('my_role');

  return (
    <header className="mb-6 flex flex-wrap items-center gap-3 border-b pb-4">
      <Link href="/questions" className="font-bold">
        بنك الأسئلة
      </Link>
      {Object.entries(STATUS_LABELS).map(([key, label]) => (
        <Link key={key} href={`/questions?status=${key}`} className={linkCls}>
          {label}
        </Link>
      ))}
      <Link href="/questions?broken=1" className="text-sm text-red-800 hover:underline">
        تحتاج إصلاحًا
      </Link>
      {role === 'admin' && (
        <>
          <span className="text-gray-300">|</span>
          <Link href="/settings/team" className={linkCls}>
            الفريق
          </Link>
          <Link href="/settings/domains" className={linkCls}>
            المواقع المسموح بها
          </Link>
        </>
      )}
      <Link href="/questions/new" className="ms-auto rounded bg-emerald-700 px-3 py-1.5 text-white">
        سؤال جديد
      </Link>
      <form action={signOut}>
        <button className="text-sm text-gray-600 hover:underline">خروج</button>
      </form>
    </header>
  );
}
```

- [ ] **الخطوة 2: استعماله في تخطيط الأسئلة**

استبدل محتوى `admin/src/app/questions/layout.tsx`:

`admin/src/app/questions/layout.tsx`:

```tsx
import { AppHeader } from '@/components/AppHeader';

export default function QuestionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <AppHeader />
      {children}
    </div>
  );
}
```

- [ ] **الخطوة 3: فلتر الروابط المعطلة في القائمة**

استبدل محتوى `admin/src/app/questions/page.tsx`:

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
  question_media: { broken_at: string | null }[];
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; broken?: string }>;
}) {
  const { status, broken } = await searchParams;
  const onlyBroken = broken === '1';
  const supabase = await createClient();

  let query = supabase
    .from('questions')
    .select(
      `id, prompt, status, difficulty, origin, categories(name_ar), ${onlyBroken ? 'question_media!inner(broken_at)' : 'question_media(broken_at)'}`,
    )
    .order('updated_at', { ascending: false })
    .limit(200);
  if (status && isQuestionStatus(status)) query = query.eq('status', status);
  if (onlyBroken) query = query.not('question_media.broken_at', 'is', null);

  const { data, error } = await query.returns<ListRow[]>();
  if (error) return <p className="text-red-700">{error.message}</p>;

  return (
    <div className="space-y-3">
      {onlyBroken && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          أسئلة فيها رابط وسيط معطل. ما كان منها منشورًا أُوقف آليًا: أصلح الرابط ثم أرسل السؤال للمراجعة.
        </p>
      )}
      {!data || data.length === 0 ? (
        <p className="text-gray-600">لا توجد أسئلة في هذه القائمة.</p>
      ) : (
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
                  {q.question_media.some((m) => m.broken_at) && (
                    <span className="ms-2 rounded bg-red-100 px-1.5 text-xs text-red-900">رابط معطل</span>
                  )}
                </td>
                <td className="p-2">{q.categories?.name_ar}</td>
                <td className="p-2">{DIFFICULTY_LABELS[q.difficulty]}</td>
                <td className="p-2">{STATUS_LABELS[q.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **الخطوة 4: تنبيه الرابط المعطل في صفحة السؤال**

في `admin/src/app/questions/[id]/page.tsx` ثلاثة تعديلات:

1. نوع الصف يحمل حقلي الفحص:

```tsx
type MediaRow = MediaDefaults & { placement: Placement; broken_at: string | null; check_error: string | null };
```

2. استعلام الوسائط يجلبهما:

```tsx
supabase.from('question_media').select('placement, kind, url, start_seconds, end_seconds, alt_text, broken_at, check_error').eq('question_id', id).returns<MediaRow[]>(),
```

ودالة `pick` تُرجع `MediaRow | null` بدل `MediaDefaults | null`.

3. تحت `<MediaPreview … />` مباشرة:

```tsx
{m.broken_at && (
  <p className="text-sm text-red-700">
    الرابط معطل منذ {new Date(m.broken_at).toLocaleDateString('ar')}: {m.check_error}
  </p>
)}
```

- [ ] **الخطوة 5: فحص الأنواع والاختبارات**

```bash
npx tsc --noEmit && npm test
```

المتوقع: لا أخطاء.

- [ ] **الخطوة 6: Commit**

```bash
git add src
git commit -m "feat(admin): shared header and needs-fixing list"
```

---

### المهمة 8: صفحة المواقع المسموح بها

**الملفات:**
- إنشاء: `admin/src/app/settings/layout.tsx`، `admin/src/app/settings/domains/actions.ts`، `admin/src/app/settings/domains/DomainForm.tsx`، `admin/src/app/settings/domains/page.tsx`

- [ ] **الخطوة 1: تخطيط الإعدادات للمدير وحده**

`admin/src/app/settings/layout.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/AppHeader';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('my_role');
  if (role !== 'admin') notFound();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <AppHeader />
      {children}
    </div>
  );
}
```

- [ ] **الخطوة 2: الإجراءات**

`admin/src/app/settings/domains/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeDomain } from '@/lib/domains';
import type { FormState } from '@/app/questions/actions';

export async function addDomain(_prev: FormState, fd: FormData): Promise<FormState> {
  const domain = normalizeDomain(String(fd.get('domain') ?? ''));
  if (!domain) return { errors: ['اكتب اسم موقع صالحًا مثل tafsir.net'] };

  const supabase = await createClient();
  const { error } = await supabase.from('allowed_media_domains').insert({ domain });
  if (error) return { errors: [error.code === '23505' ? 'هذا الموقع مضاف من قبل' : error.message] };

  revalidatePath('/settings/domains');
  return null;
}

export async function removeDomain(domain: string) {
  const supabase = await createClient();
  await supabase.from('allowed_media_domains').delete().eq('domain', domain);
  revalidatePath('/settings/domains');
}
```

- [ ] **الخطوة 3: نموذج الإضافة**

`admin/src/app/settings/domains/DomainForm.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { addDomain } from './actions';

export function DomainForm() {
  const [state, action, pending] = useActionState(addDomain, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="domain" required dir="ltr" placeholder="tafsir.net" className="flex-1 rounded border p-2" />
        <button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
          إضافة
        </button>
      </div>
      {state?.errors.length ? <p className="text-sm text-red-700">{state.errors.join('، ')}</p> : null}
    </form>
  );
}
```

- [ ] **الخطوة 4: الصفحة**

`admin/src/app/settings/domains/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { DomainForm } from './DomainForm';
import { removeDomain } from './actions';

export default async function DomainsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('allowed_media_domains').select('domain').order('domain');

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-bold">المواقع المسموح بها للوسائط</h1>
      <p className="text-sm text-gray-600">
        لا يُقبل رابط وسيط إلا من هذه المواقع أو نطاقاتها الفرعية، وبـ https. حذف موقع لا يمسّ الوسائط المحفوظة، لكنه
        يمنع حفظ روابط جديدة منه.
      </p>
      <ul className="divide-y rounded border bg-white">
        {(data ?? []).map(({ domain }) => (
          <li key={domain} className="flex items-center justify-between p-2">
            <span dir="ltr">{domain}</span>
            <form action={removeDomain.bind(null, domain)}>
              <button className="text-sm text-red-700 hover:underline">حذف</button>
            </form>
          </li>
        ))}
      </ul>
      <DomainForm />
    </div>
  );
}
```

- [ ] **الخطوة 5: فحص الأنواع**

```bash
npx tsc --noEmit
```

- [ ] **الخطوة 6: Commit**

```bash
git add src
git commit -m "feat(admin): manage allowed media domains"
```

---

### المهمة 9: صفحة الفريق

إنشاء الحسابات يحتاج مفتاح الخدمة، فيُضاف إلى `admin/.env.local` باسم لا يبدأ بـ `NEXT_PUBLIC_` كي لا يصل إلى المتصفح أبدًا:

```
SUPABASE_SERVICE_ROLE_KEY=<service_role key من supabase start>
```

**الملفات:**
- إنشاء: `admin/src/lib/supabase/admin.ts`، `admin/src/app/settings/team/actions.ts`، `admin/src/app/settings/team/RoleForm.tsx`، `admin/src/app/settings/team/MemberForm.tsx`، `admin/src/app/settings/team/page.tsx`

- [ ] **الخطوة 1: عميل مفتاح الخدمة**

`admin/src/lib/supabase/admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

// للخادم فقط: يتجاوز الصلاحيات، فلا يُستعمل إلا بعد التحقق من أن المستدعي مدير.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY غير مضبوط');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **الخطوة 2: الإجراءات**

`admin/src/app/settings/team/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRole, parseNewMember } from '@/lib/team';

export type TeamState = { errors: string[]; message?: string } | null;

export async function setRole(id: string, _prev: TeamState, fd: FormData): Promise<TeamState> {
  const role = String(fd.get('role') ?? '');
  if (!isRole(role)) return { errors: ['دور غير معروف'] };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_user_role', { target: id, new_role: role });
  if (error) return { errors: [error.message] };

  revalidatePath('/settings/team');
  return { errors: [], message: 'حُفظ' };
}

export async function createMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const parsed = parseNewMember(fd);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => i.message) };

  const supabase = await createClient();
  const { data: myRole } = await supabase.rpc('my_role');
  if (myRole !== 'admin') return { errors: ['إدارة الفريق للمدير فقط'] };

  const { email, displayName, password, role } = parsed.data;
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) return { errors: [error.code === 'email_exists' ? 'هذا البريد مسجَّل من قبل' : error.message] };

  if (role !== 'writer') {
    const { error: roleError } = await supabase.rpc('set_user_role', { target: data.user.id, new_role: role });
    if (roleError) return { errors: [roleError.message] };
  }

  revalidatePath('/settings/team');
  return { errors: [], message: `أُنشئ حساب ${email}` };
}
```

- [ ] **الخطوة 3: نموذج تغيير الدور**

`admin/src/app/settings/team/RoleForm.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { setRole } from './actions';
import { ROLE_LABELS } from '@/lib/team';
import type { Role } from '@/lib/status';

export function RoleForm({ id, role }: { id: string; role: Role }) {
  const [state, action, pending] = useActionState(setRole.bind(null, id), null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <select name="role" defaultValue={role} aria-label="الدور" className="rounded border p-1">
        {Object.entries(ROLE_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <button disabled={pending} className="rounded border border-gray-400 px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50">
        حفظ
      </button>
      {state?.errors.length ? <span className="text-sm text-red-700">{state.errors.join('، ')}</span> : null}
      {state?.message ? <span className="text-sm text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
```

- [ ] **الخطوة 4: نموذج العضو الجديد**

يُرسَل عبر `startTransition` كما في `QuestionForm`، حتى لا تُمسح الحقول عند ظهور خطأ، ويُفرَّغ يدويًا عند النجاح.

`admin/src/app/settings/team/MemberForm.tsx`:

```tsx
'use client';

import { useRef, useState, useTransition } from 'react';
import { createMember, type TeamState } from './actions';
import { ROLE_LABELS } from '@/lib/team';

const inputCls = 'w-full rounded border p-2';

export function MemberForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<TeamState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const next = await createMember(null, fd);
      setState(next);
      if (next && next.errors.length === 0) ref.current?.reset();
    });
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3 rounded border bg-white p-4">
      <h2 className="font-bold">إضافة عضو</h2>
      {state?.errors.length ? (
        <ul className="list-disc rounded border border-red-300 bg-red-50 p-3 ps-8 text-sm text-red-800">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {state?.message ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="displayName" required placeholder="الاسم" className={inputCls} />
        <input name="email" type="email" required placeholder="البريد الإلكتروني" dir="ltr" className={inputCls} />
        <input name="password" type="password" required minLength={10} placeholder="كلمة مرور مؤقتة (10 أحرف فأكثر)" dir="ltr" className={inputCls} />
        <select name="role" defaultValue="writer" aria-label="الدور" className={inputCls}>
          {Object.entries(ROLE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button disabled={pending} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
      </button>
    </form>
  );
}
```

- [ ] **الخطوة 5: الصفحة**

`admin/src/app/settings/team/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ROLE_LABELS } from '@/lib/team';
import type { Role } from '@/lib/status';
import { RoleForm } from './RoleForm';
import { MemberForm } from './MemberForm';

type Profile = { id: string; display_name: string; role: Role };

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profiles }, { data: users }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role').order('display_name').returns<Profile[]>(),
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? '']));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">الفريق</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-start">الاسم</th>
            <th className="p-2 text-start">البريد</th>
            <th className="p-2 text-start">الدور</th>
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((p) => (
            <tr key={p.id} className="border-b">
              <td className="p-2">{p.display_name}</td>
              <td className="p-2" dir="ltr">
                {emails.get(p.id)}
              </td>
              <td className="p-2">
                {p.id === user?.id ? `${ROLE_LABELS[p.role]} (أنت)` : <RoleForm id={p.id} role={p.role} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <MemberForm />
    </div>
  );
}
```

- [ ] **الخطوة 6: فحص الأنواع والاختبارات والبناء**

```bash
npx tsc --noEmit && npm test && npm run build
```

المتوقع: لا أخطاء، والبناء يكتمل.

- [ ] **الخطوة 7: Commit**

```bash
git add src
git commit -m "feat(admin): team management"
```

---

### المهمة 10: تجربة المسار كاملًا يدويًا

- [ ] **الخطوة 1: التشغيل**

```bash
npx supabase db reset
cd admin && npm run build && npm run start
```

وأنشئ حساب مدير واحدًا من لوحة Supabase (أو عبر واجهة المصادقة بمفتاح الخدمة)، ثم رقّه بـ SQL كما في الخطة 1.

- [ ] **الخطوة 2: تنفيذ القائمة والتأكد من كل بند**

1. بحساب المدير: افتح «الفريق» وأنشئ كاتبًا ومراجعًا. المتوقع: يظهران في الجدول بدوريهما، ورسالة «أُنشئ حساب …».
2. أنشئ عضوًا ببريد مسجَّل. المتوقع: «هذا البريد مسجَّل من قبل»، وتبقى الحقول.
3. غيّر دور الكاتب إلى مراجع ثم أعده. المتوقع: «حُفظ» في كل مرة. ولا يظهر نموذج تغيير الدور في صف المدير نفسه.
4. بحساب الكاتب: لا تظهر روابط «الفريق» و«المواقع»، وفتح `/settings/team` مباشرة يُظهر صفحة «غير موجود».
5. بحساب المدير: أضف `https://www.Tafsir.net/x`. المتوقع: يُحفظ `tafsir.net`. ثم أضفه مرة أخرى. المتوقع: «هذا الموقع مضاف من قبل».
6. بحساب الكاتب: احفظ سؤالًا بصورة من `https://cdn.tafsir.net/a.png`. المتوقع: يُقبل. ثم احذف المدير `tafsir.net`، وجرّب رابطًا جديدًا منه. المتوقع: «الرابط ليس من المواقع المسموح بها…».
7. انشر سؤالًا بوسيط عبر المسار الكامل، ثم سجّل له فحصًا فاشلًا بمفتاح الخدمة:
   `select public.record_link_check('<media id>', false, 'HTTP 404');` (أو شغّل الفاحص على رابط محذوف).
   المتوقع: السؤال «موقوف»، وملاحظة «أُوقف آليًا…»، ويظهر في «تحتاج إصلاحًا» بشارة «رابط معطل»، وصفحته تقول «الرابط معطل منذ …».
8. بحساب المدير: غيّر الرابط واحفظ. المتوقع: تختفي الشارة ويخرج السؤال من «تحتاج إصلاحًا»، ثم «إرسال للمراجعة» يعمل.
9. شغّل `npm run check-links` محليًا. المتوقع: سطر JSON دون `failures`.

- [ ] **الخطوة 3: Commit الخطة**

```bash
git add docs/superpowers/plans/2026-11-20-team-domains-link-health.md
git commit -m "docs: team, domains and link health plan"
```

---

## المراجعة الذاتية

**تغطية التصميم:** الفحص اليومي الآلي (المهام 5 و6)، وإخفاء السؤال المعطل بإيقافه (المهمة 1)، وقائمة «تحتاج إصلاحًا» (المهمة 7)، وإدارة المدير للمواقع المسموح بها (المهمة 8) وللحسابات (المهمتان 2 و9). وعودة السؤال الموقوف للمراجعة بعد إصلاحه قائمة من الخطة 1.

**الأمان:** حقول الفحص لا تُكتب إلا من `record_link_check`، وهي محجوبة عن `authenticated`. وتغيير الأدوار لا يتم إلا عبر `set_user_role` لأن جدول `profiles` بلا سياسة تعديل. ومفتاح الخدمة لا يُقرأ إلا في كود الخادم وبعد التحقق من أن المستدعي مدير.

**اتساق الأسماء:** `record_link_check(m_id, ok, err)` و`set_user_role(target, new_role)` تُستدعيان بالأسماء نفسها في السكربت والإجراءات. ورسائل الخطأ في الاختبارات مطابقة حرفيًا لما في الترحيلات والمكتبات.
