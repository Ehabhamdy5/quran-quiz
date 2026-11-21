begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'writer@test.local', '{"staff":true}'),
  ('00000000-0000-0000-0000-00000000000b', 'reviewer@test.local', '{"staff":true}');
update public.profiles set role = 'reviewer' where id = '00000000-0000-0000-0000-00000000000b';
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000f1', true),
  ('00000000-0000-0000-0000-0000000000f2', true),
  ('00000000-0000-0000-0000-0000000000f3', true);

insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page, author_id)
values ('10000000-0000-0000-0000-000000000001', 'رتّب', 'ordering', 2, 'beginner', '["الأول","الثاني","الثالث"]', null,
        'فائدة', 'مصدر', '1', '00000000-0000-0000-0000-00000000000a');
select set_config('app.in_transition', 'on', true);
update public.questions set status = 'published';
select set_config('app.in_transition', 'off', true);

set local role authenticated;

-- اللاعب الأول يرتّب خطأً ويبلّغ.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select public.register_player('الأول');
create temp table r1 as select (public.start_round(2::smallint) ->> 'round_id')::uuid as id;
select is(jsonb_array_length(public.show_question((select id from r1), 1::smallint) -> 'options'), 3, 'ordering items are sent');
select is(public.answer_question((select id from r1), 1::smallint, '["الثاني","الأول","الثالث"]') ->> 'is_correct', 'false',
  'a wrong order is wrong');
select lives_ok($$ select public.report_question('10000000-0000-0000-0000-000000000001', 'الترتيب غير دقيق') $$, 'a player reports a question they saw');
select is((select count(*)::int from public.question_reports), 0, 'players cannot read reports');

-- اللاعب الثاني يرتّب صحيحًا ويبلّغ.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select public.register_player('الثاني');
create temp table r2 as select (public.start_round(2::smallint) ->> 'round_id')::uuid as id;
select public.show_question((select id from r2), 1::smallint);
select is(public.answer_question((select id from r2), 1::smallint, '["الأول","الثاني","الثالث"]') -> 'options',
  '["الأول","الثاني","الثالث"]'::jsonb, 'the right order is revealed after answering');
select public.report_question('10000000-0000-0000-0000-000000000001', 'يحتاج مراجعة');

-- اللاعب الثالث لا يبلّغ قبل أن يرى السؤال، ثم يراه فيبلّغ فيُوقف.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select public.register_player('الثالث');
select throws_ok($$ select public.report_question('10000000-0000-0000-0000-000000000001', 'خطأ') $$, 'P0001',
  'لا يمكن الإبلاغ إلا عن سؤال ظهر لك', 'only questions you saw can be reported');
select throws_ok($$ select public.question_stats('10000000-0000-0000-0000-000000000001') $$, 'P0001', 'للفريق فقط',
  'players cannot read question stats');
create temp table r3 as select (public.start_round(2::smallint) ->> 'round_id')::uuid as id;
select public.show_question((select id from r3), 1::smallint);
select public.report_question('10000000-0000-0000-0000-000000000001', 'خطأ في الترتيب');

reset role;
select is((select status::text from public.questions where id = '10000000-0000-0000-0000-000000000001'), 'suspended',
  'three open reports suspend a published question');
select is((select review_notes from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'أُوقف آليًا بعد 3 بلاغات من اللاعبين', 'the suspension explains itself');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select row(answers, correct, open_reports)::text from public.question_stats('10000000-0000-0000-0000-000000000001')),
  '(2,1,3)', 'staff see answers, correct answers and open reports');
select is((select count(*)::int from public.question_reports), 3, 'staff read the reports');

reset role;
set local role anon;
select throws_ok($$ select public.start_round(null) $$, '42501', null, 'anonymous visitors without a session cannot play');

select * from finish();
rollback;
