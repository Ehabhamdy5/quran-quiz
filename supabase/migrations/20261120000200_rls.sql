create function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.can_edit_question(q_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.questions q
    where q.id = q_id
      and q.status in ('draft', 'needs_changes', 'suspended')
      and (q.author_id = auth.uid() or public.my_role() = 'admin')
  )
$$;

-- أي تعديل خارج transition_question لا يغيّر الحالة ولا حقول المراجعة.
create function public.guard_question_update() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.in_transition', true), '') <> 'on' then
    if new.status is distinct from old.status then
      raise exception 'لا تتغير حالة السؤال إلا عبر مسار المراجعة';
    end if;
    new.author_id := old.author_id;
    new.origin := old.origin;
    new.reviewer_id := old.reviewer_id;
    new.review_notes := old.review_notes;
    new.approved_at := old.approved_at;
    new.published_at := old.published_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger questions_guard_update
before update on public.questions
for each row execute function public.guard_question_update();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.allowed_media_domains enable row level security;
alter table public.questions enable row level security;
alter table public.question_media enable row level security;

create policy profiles_staff_read on public.profiles
  for select to authenticated using (public.my_role() is not null);

create policy categories_read on public.categories
  for select to authenticated using (true);

create policy domains_read on public.allowed_media_domains
  for select to authenticated using (true);
create policy domains_admin_write on public.allowed_media_domains
  for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy questions_staff_read on public.questions
  for select to authenticated using (public.my_role() is not null);
create policy questions_insert on public.questions
  for insert to authenticated with check (
    public.my_role() in ('writer', 'admin')
    and author_id = auth.uid()
    and status = 'draft'
    and reviewer_id is null and approved_at is null and published_at is null
  );
create policy questions_update on public.questions
  for update to authenticated using (public.can_edit_question(id)) with check (true);
create policy questions_delete on public.questions
  for delete to authenticated using (
    status = 'draft' and (author_id = auth.uid() or public.my_role() = 'admin')
  );

create policy media_staff_read on public.question_media
  for select to authenticated using (public.my_role() is not null);
create policy media_insert on public.question_media
  for insert to authenticated with check (public.can_edit_question(question_id));
create policy media_update on public.question_media
  for update to authenticated
  using (public.can_edit_question(question_id)) with check (public.can_edit_question(question_id));
create policy media_delete on public.question_media
  for delete to authenticated using (public.can_edit_question(question_id));
