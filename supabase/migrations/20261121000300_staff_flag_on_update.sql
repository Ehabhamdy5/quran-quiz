-- خدمة المصادقة تكتب app_metadata بعد إنشاء الحساب، فيُنشأ ملف الفريق عند ظهور العلامة أيضًا.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'staff', '') = 'true' then
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email, 'مستخدم'))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_staff_flag
after update of raw_app_meta_data on auth.users
for each row
when (coalesce(new.raw_app_meta_data ->> 'staff', '') = 'true'
      and coalesce(old.raw_app_meta_data ->> 'staff', '') <> 'true')
execute function public.handle_new_user();
