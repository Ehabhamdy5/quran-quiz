begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local', '{"staff":true}'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local', '{"staff":true}');
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
