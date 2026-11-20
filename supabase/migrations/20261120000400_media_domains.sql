create function public.check_media_domain() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  host text := lower(substring(new.url from '^https://([^/:?#]+)'));
begin
  if host is null or not exists (
    select 1 from public.allowed_media_domains d
    where host = d.domain or host like '%.' || d.domain
  ) then
    raise exception 'الرابط ليس من المواقع المسموح بها';
  end if;
  return new;
end $$;

create trigger question_media_check_domain
before insert or update of url on public.question_media
for each row execute function public.check_media_domain();
