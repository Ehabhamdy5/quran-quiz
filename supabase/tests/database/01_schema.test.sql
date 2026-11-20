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
