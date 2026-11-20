alter table public.question_media
  add column checked_at timestamptz,
  add column broken_at timestamptz,
  add column check_error text;

create index question_media_broken_idx on public.question_media (question_id) where broken_at is not null;

-- حقول الفحص لا يكتبها إلا الفاحص، وتغيير الرابط يمحو حكمه القديم.
create function public.guard_media_health() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.in_link_check', true), '') <> 'on' then
    if tg_op = 'INSERT' or new.url is distinct from old.url then
      new.checked_at := null;
      new.broken_at := null;
      new.check_error := null;
    else
      new.checked_at := old.checked_at;
      new.broken_at := old.broken_at;
      new.check_error := old.check_error;
    end if;
  end if;
  return new;
end $$;

create trigger question_media_guard_health
before insert or update on public.question_media
for each row execute function public.guard_media_health();

-- يُرجع true إذا أوقف سؤالًا منشورًا.
create function public.record_link_check(m_id uuid, ok boolean, err text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  q_id uuid;
  reason text := coalesce(nullif(trim(err), ''), 'تعذّر الوصول');
  suspended boolean := false;
begin
  perform set_config('app.in_link_check', 'on', true);
  update public.question_media set
    checked_at = now(),
    broken_at = case when ok then null else coalesce(broken_at, now()) end,
    check_error = case when ok then null else reason end
  where id = m_id
  returning question_id into q_id;
  perform set_config('app.in_link_check', 'off', true);

  if q_id is null then
    raise exception 'الوسيط غير موجود';
  end if;

  if not ok then
    perform set_config('app.in_transition', 'on', true);
    update public.questions set
      status = 'suspended',
      review_notes = 'أُوقف آليًا لأن رابط الوسيط معطل: ' || reason
    where id = q_id and status = 'published';
    suspended := found;
    perform set_config('app.in_transition', 'off', true);
  end if;
  return suspended;
end $$;

revoke execute on function public.record_link_check(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.record_link_check(uuid, boolean, text) to service_role;
