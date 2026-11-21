begin;
create extension if not exists pgtap with schema extensions;
-- عزل الاختبار عن أي أسئلة في القاعدة المحلية (يُتراجع عنه في آخره).
delete from public.questions;
select plan(4);

insert into auth.users (id, email, raw_app_meta_data) values ('00000000-0000-0000-0000-00000000000a', 'writer@test.local', '{"staff":true}');
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000f1', true);
insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit, source_book, source_page, author_id)
values ('10000000-0000-0000-0000-000000000001', 'سؤال', 'mcq', 1, 'beginner', '["الصحيح","ب","ج","د"]', '0', 'فائدة', 'مصدر', '1',
        '00000000-0000-0000-0000-00000000000a');
select set_config('app.in_transition', 'on', true);
update public.questions set status = 'published';
select set_config('app.in_transition', 'off', true);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select public.register_player('لاعب');
create temp table r as select (public.start_round(null) ->> 'round_id')::uuid as id;
create temp table shown as select public.show_question((select id from r), 1::smallint) -> 'options' as opts;

select is((select jsonb_agg(v order by v) from jsonb_array_elements((select opts from shown)) v),
  '["الصحيح","ب","ج","د"]'::jsonb, 'the shown options are the same four');
select is((select public.show_question((select id from r), 1::smallint) -> 'options'), (select opts from shown),
  'showing the question again keeps the same order');
-- الإجابة برقم الخيار الصحيح كما ظهر للاعب
select is(public.answer_question((select id from r), 1::smallint,
  to_jsonb((select ord - 1 from jsonb_array_elements_text((select opts from shown)) with ordinality t(v, ord) where v = 'الصحيح')))
  ->> 'is_correct', 'true', 'answers are checked against the shown order');

reset role;
select is((select array_length(option_order, 1) from public.round_questions where round_id = (select id from r)), 4,
  'the shown order is stored with the round');

select * from finish();
rollback;
