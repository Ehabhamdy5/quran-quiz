create type public.user_role as enum ('writer', 'reviewer', 'admin');
create type public.question_status as enum ('draft', 'in_review', 'needs_changes', 'approved', 'published', 'suspended');
create type public.question_type as enum ('mcq', 'true_false', 'visual', 'ordering');
create type public.difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.question_origin as enum ('human', 'ai');
create type public.media_placement as enum ('question', 'answer');
create type public.media_kind as enum ('image', 'video');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.user_role not null default 'writer'
);

create table public.categories (
  id smallint primary key,
  slug text not null unique,
  name_ar text not null
);

insert into public.categories (id, slug, name_ar) values
  (1, 'tafsir', 'التفسير'),
  (2, 'word_meanings', 'معاني الكلمات'),
  (3, 'quran_stories', 'قصص القرآن'),
  (4, 'prophets', 'قصص الأنبياء');

create table public.allowed_media_domains (
  domain text primary key check (domain = lower(domain))
);

insert into public.allowed_media_domains (domain) values ('youtube.com'), ('youtu.be');

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (length(trim(prompt)) > 0),
  type public.question_type not null,
  category_id smallint not null references public.categories (id),
  difficulty public.difficulty not null,
  options jsonb,
  correct_answer jsonb,
  benefit text not null check (length(trim(benefit)) > 0),
  source_book text not null check (length(trim(source_book)) > 0),
  source_volume text,
  source_page text not null check (length(trim(source_page)) > 0),
  surah smallint check (surah between 1 and 114),
  ayah smallint check (ayah >= 1),
  origin public.question_origin not null default 'human',
  status public.question_status not null default 'draft',
  author_id uuid not null default auth.uid() references public.profiles (id),
  reviewer_id uuid references public.profiles (id),
  review_notes text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((surah is null) = (ayah is null))
);

create index questions_status_updated_idx on public.questions (status, updated_at desc);

create table public.question_media (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  placement public.media_placement not null,
  kind public.media_kind not null,
  url text not null check (url ~* '^https://'),
  start_seconds integer check (start_seconds >= 0),
  end_seconds integer,
  alt_text text not null check (length(trim(alt_text)) > 0),
  created_at timestamptz not null default now(),
  check (start_seconds is null or end_seconds is null or end_seconds > start_seconds),
  unique (question_id, placement)
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email, 'مستخدم'));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
