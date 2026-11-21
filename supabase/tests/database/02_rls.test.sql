begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local', '{"staff":true}'),
  ('00000000-0000-0000-0000-00000000000b', 'reviewer@test.local', '{"staff":true}'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local', '{"staff":true}');
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
