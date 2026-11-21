begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'writer@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$
  insert into public.questions (id, prompt, type, category_id, difficulty, options, correct_answer, benefit,
    source_book, source_page, surah, ayah, origin, source_excerpt)
  values ('10000000-0000-0000-0000-000000000001', 'ما معنى الصمد؟', 'mcq', 2, 'beginner', '["أ","ب","ج","د"]', '0',
    'فائدة', 'المختصر في تفسير القرآن الكريم (عربي)', 'تفسير الآية 112:2', 112, 2, 'ai', 'الذي تصمد إليه الخلائق')
$$, 'a generated draft keeps its excerpt');

select throws_ok($$
  insert into public.questions (prompt, type, category_id, difficulty, options, correct_answer, benefit,
    source_book, source_page, source_excerpt)
  values ('سؤال', 'true_false', 1, 'beginner', null, 'true', 'فائدة', 'مصدر', '1', 'اقتباس')
$$, '23514', null, 'a human question cannot carry a generation excerpt');

update public.questions set source_excerpt = 'اقتباس آخر', origin = 'human'
where id = '10000000-0000-0000-0000-000000000001';
select is((select source_excerpt from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'الذي تصمد إليه الخلائق', 'the excerpt cannot be edited');
select is((select origin::text from public.questions where id = '10000000-0000-0000-0000-000000000001'),
  'ai', 'the generated mark cannot be removed');

select * from finish();
rollback;
