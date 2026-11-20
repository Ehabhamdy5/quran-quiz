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
