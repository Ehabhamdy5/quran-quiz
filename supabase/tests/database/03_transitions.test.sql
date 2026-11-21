begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local', '{"staff":true}'),
  ('00000000-0000-0000-0000-00000000000b', 'reviewer@test.local', '{"staff":true}'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local', '{"staff":true}');
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
