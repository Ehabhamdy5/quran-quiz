begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- خدمة المصادقة تنشئ الحساب أولًا ثم تكتب app_metadata في تحديث لاحق.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'later@test.local', '{"provider":"email"}');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 0,
  'no profile before the staff flag');

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"staff":true}'
where id = '00000000-0000-0000-0000-0000000000e1';
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 'writer',
  'adding the staff flag later creates a writer profile');

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"x":1}' where id = '00000000-0000-0000-0000-0000000000e1';
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 1,
  'later metadata updates do not duplicate the profile');

select * from finish();
rollback;
