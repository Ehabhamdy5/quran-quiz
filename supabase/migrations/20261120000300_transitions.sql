create function public.transition_question(
  q_id uuid,
  target public.question_status,
  notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  q public.questions;
  r public.user_role := public.my_role();
  me uuid := auth.uid();
begin
  if r is null then
    raise exception 'هذا الحساب ليس من فريق المحتوى';
  end if;

  select * into q from public.questions where id = q_id for update;
  if not found then
    raise exception 'السؤال غير موجود';
  end if;

  if q.status in ('draft', 'needs_changes') and target = 'in_review' then
    if not (q.author_id = me or r = 'admin') then
      raise exception 'الإرسال للمراجعة لكاتب السؤال أو المدير';
    end if;
  elsif q.status = 'in_review' and target = 'approved' then
    if r not in ('reviewer', 'admin') then
      raise exception 'الاعتماد للمراجعين فقط';
    end if;
    if q.author_id = me then
      raise exception 'لا يجوز اعتماد سؤال كتبته بنفسك';
    end if;
  elsif q.status = 'in_review' and target = 'needs_changes' then
    if r not in ('reviewer', 'admin') then
      raise exception 'الإعادة للتعديل للمراجعين فقط';
    end if;
    if coalesce(trim(notes), '') = '' then
      raise exception 'ملاحظات المراجعة مطلوبة عند الإعادة للتعديل';
    end if;
  elsif q.status = 'approved' and target = 'published' then
    if r <> 'admin' then
      raise exception 'النشر للمدير فقط';
    end if;
  elsif q.status = 'published' and target = 'suspended' then
    if r <> 'admin' then
      raise exception 'الإيقاف للمدير فقط';
    end if;
  elsif q.status = 'suspended' and target = 'in_review' then
    if r <> 'admin' then
      raise exception 'إعادة السؤال الموقوف للمراجعة للمدير فقط';
    end if;
  else
    raise exception '%', format('الانتقال من %s إلى %s غير مسموح', q.status, target);
  end if;

  if target = 'in_review' and q.type = 'visual' and not exists (
    select 1 from public.question_media m where m.question_id = q.id and m.placement = 'question'
  ) then
    raise exception 'السؤال المرئي يحتاج وسيطًا مع السؤال';
  end if;

  perform set_config('app.in_transition', 'on', true);
  update public.questions set
    status = target,
    reviewer_id = case when target in ('approved', 'needs_changes') then me else reviewer_id end,
    review_notes = case
      when target = 'needs_changes' then trim(notes)
      when target = 'approved' then null
      else review_notes end,
    approved_at = case when target = 'approved' then now() else approved_at end,
    published_at = case when target = 'published' then now() else published_at end
  where id = q_id;
  perform set_config('app.in_transition', 'off', true);
end $$;
