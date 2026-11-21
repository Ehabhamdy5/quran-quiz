begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local', '{"staff":true}'),
  ('00000000-0000-0000-0000-00000000000b', 'reviewer@test.local', '{"staff":true}');
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
