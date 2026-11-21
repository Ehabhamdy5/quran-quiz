alter table public.questions
  add column source_excerpt text,
  add constraint questions_excerpt_only_ai check (source_excerpt is null or origin = 'ai');

-- نسخة من حارس الخطة 1 مع قفل الاقتباس.
create or replace function public.guard_question_update() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.in_transition', true), '') <> 'on' then
    if new.status is distinct from old.status then
      raise exception 'لا تتغير حالة السؤال إلا عبر مسار المراجعة';
    end if;
    new.author_id := old.author_id;
    new.origin := old.origin;
    new.source_excerpt := old.source_excerpt;
    new.reviewer_id := old.reviewer_id;
    new.review_notes := old.review_notes;
    new.approved_at := old.approved_at;
    new.published_at := old.published_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
