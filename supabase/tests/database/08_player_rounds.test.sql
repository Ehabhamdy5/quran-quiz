begin;
create extension if not exists pgtap with schema extensions;
-- عزل الاختبار عن أي أسئلة في القاعدة المحلية (يُتراجع عنه في آخره).
delete from public.questions;
select plan(17);

-- كاتب من الفريق، ولاعب مجهول.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local', '{"staff":true}');
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000f1', true);

-- أربعة أسئلة منشورة للمبتدئ في التفسير، إجابتها كلها الخيار الأول، وسؤال متوسط لا يدخل الجولة.
insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page, author_id)
select ('10000000-0000-0000-0000-00000000000' || i)::uuid, 'سؤال ' || i, 'mcq', 1, 'beginner', '["أ","ب","ج","د"]', '0',
       'فائدة', 'مصدر', '1', '00000000-0000-0000-0000-00000000000a'
from generate_series(1, 4) i;
insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page, author_id)
values ('10000000-0000-0000-0000-000000000009', 'سؤال متوسط', 'true_false', 1, 'intermediate', null, 'true', 'فائدة', 'مصدر', '1', '00000000-0000-0000-0000-00000000000a');
select set_config('app.in_transition', 'on', true);
update public.questions set status = 'published';
select set_config('app.in_transition', 'off', true);

-- رقم الخيار الصحيح «أ» كما ظهر للاعب بعد الخلط.
create function pg_temp.right_choice(shown jsonb) returns jsonb language sql as $$
  select to_jsonb(ord - 1) from jsonb_array_elements_text(shown -> 'options') with ordinality t(v, ord) where v = 'أ'
$$;

select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'a self-registered player gets no staff profile');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select is((select count(*)::int from public.questions), 0, 'players cannot read the question bank');
select throws_ok($$ select public.start_round(1::smallint) $$, 'P0001', 'سجّل اسمك للبدء', 'a round needs a registered name');
select throws_ok($$ select public.register_player('ا') $$, 'P0001', 'الاسم من حرفين إلى 24 حرفًا', 'names are 2 to 24 letters');
select lives_ok($$ select public.register_player('  لاعب   التجربة ') $$, 'a player registers a name');

create temp table r1 as select (public.start_round(1::smallint) ->> 'round_id')::uuid as id;
select is((select question_count from public.rounds where id = (select id from r1)), null::smallint,
  'players cannot read rounds directly');
select throws_ok($$ select public.show_question((select id from r1), 2::smallint) $$, 'P0001', 'أجب عن السؤال الحالي أولًا',
  'questions come in order');
select throws_ok($$ select public.answer_question((select id from r1), 1::smallint, '0') $$, 'P0001', 'لم يُعرض هذا السؤال بعد',
  'no answer before the question is shown');
create temp table s1 as select public.show_question((select id from r1), 1::smallint) as j;
select ok(not ((select j from s1) ? 'correct_answer'), 'the answer is not sent with the question');

-- الإجابة فورية داخل المعاملة: 10 + مكافأة السرعة كاملة 5.
select is((public.answer_question((select id from r1), 1::smallint, pg_temp.right_choice((select j from s1))) ->> 'points')::int, 15,
  'a fast correct answer scores 15');
select throws_ok($$ select public.answer_question((select id from r1), 1::smallint, '0') $$, 'P0001', 'أُجيب عن هذا السؤال من قبل',
  'one answer per question');
select public.answer_question((select id from r1), 2::smallint, pg_temp.right_choice(public.show_question((select id from r1), 2::smallint)));
select is((public.answer_question((select id from r1), 3::smallint, pg_temp.right_choice(public.show_question((select id from r1), 3::smallint)))
  ->> 'points')::int, 20, 'the third correct in a row adds the streak bonus');

-- سؤال تأخر جوابه 30 ثانية.
select public.show_question((select id from r1), 4::smallint);
reset role;
update public.round_questions set shown_at = now() - interval '30 seconds' where round_id = (select id from r1) and position = 4;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is(public.answer_question((select id from r1), 4::smallint, '0') ->> 'timed_out', 'true', 'a late answer times out');

select is(public.finish_round((select id from r1)), '{"score": 50, "total": 4, "correct": 3, "promoted_to": null}'::jsonb,
  'finishing reports score, correct and total');

-- ترقية: جولتان سابقتان كاملتان، ثم جولة بدقة 100%.
reset role;
update public.rounds set finished_at = now() - interval '3 days' where id = (select id from r1);
insert into public.rounds (player_id, level, question_count, score, correct_count, started_at, finished_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'beginner', 10, 0, 10, now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000f1', 'beginner', 10, 0, 9, now() - interval '1 day', now() - interval '1 day');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
create temp table r2 as select (public.start_round(null) ->> 'round_id')::uuid as id;
select public.answer_question((select id from r2), i::smallint, pg_temp.right_choice(public.show_question((select id from r2), i::smallint)))
from generate_series(1, 4) i;
select is(public.finish_round((select id from r2)) ->> 'promoted_to', 'intermediate', 'three strong rounds promote the player');

select is((select points from public.leaderboard('all_time') where is_me), 120::bigint, 'the all-time board sums finished rounds');
select is((select display_name from public.leaderboard('weekly') where is_me), 'لاعب التجربة', 'the weekly board shows the cleaned name');

select * from finish();
rollback;
