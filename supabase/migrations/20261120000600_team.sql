create function public.set_user_role(target uuid, new_role public.user_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'إدارة الفريق للمدير فقط';
  end if;
  -- يمنع أن يبقى الفريق بلا مدير بخطأ من المدير نفسه.
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'لا يغيّر المدير دوره بنفسه';
  end if;
  update public.profiles set role = new_role where id = target;
  if not found then
    raise exception 'المستخدم غير موجود';
  end if;
end $$;

revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
