-- الخطة 4: اللاعبون والجولات والنقاط ولوحات المتصدرين والبلاغات.
-- كل ما يخص اللعب يمر بدوال على الخادم: اللاعب لا يقرأ جدول الأسئلة، ولا يرى الإجابة قبل أن يجيب،
-- والوقت والنقاط تُحسب بساعة الخادم.

-- ١) حسابات الفريق تُعلَّم بـ app_metadata.staff (لا يكتبه إلا مفتاح الخدمة)، فلا يصير لاعبٌ سجّل بنفسه كاتبًا.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'staff', '') = 'true' then
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email, 'مستخدم'));
  end if;
  return new;
end $$;

-- ٢) الجداول
create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 24),
  level public.difficulty not null default 'beginner',
  created_at timestamptz not null default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  category_id smallint references public.categories (id),
  level public.difficulty not null,
  question_count smallint not null,
  score integer not null default 0,
  correct_count smallint not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index rounds_finished_idx on public.rounds (finished_at) where finished_at is not null;
create index rounds_player_idx on public.rounds (player_id, finished_at desc);

create table public.round_questions (
  round_id uuid not null references public.rounds (id) on delete cascade,
  position smallint not null check (position between 1 and 10),
  question_id uuid not null references public.questions (id) on delete cascade,
  shown_at timestamptz,
  answered_at timestamptz,
  answer jsonb,
  is_correct boolean,
  timed_out boolean,
  points integer,
  primary key (round_id, position)
);
create index round_questions_question_idx on public.round_questions (question_id);

create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  unique (question_id, player_id)
);

alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.round_questions enable row level security;
alter table public.question_reports enable row level security;

create policy players_read_own on public.players for select to authenticated using (id = auth.uid());
create policy reports_staff_read on public.question_reports
  for select to authenticated using (public.my_role() is not null);
create policy reports_staff_resolve on public.question_reports
  for update to authenticated
  using (public.my_role() in ('reviewer', 'admin')) with check (public.my_role() in ('reviewer', 'admin'));
-- لا سياسات أخرى: الجولات وإجاباتها لا تُقرأ ولا تُكتب إلا عبر الدوال أدناه.

-- ٣) ثوابت القواعد (قرارات الخطة 4 للمسائل التي تركتها الوثيقة مفتوحة)
create function public.game_rule(name text) returns integer
language sql immutable as $$
  select case name
    when 'round_size' then 10
    when 'time_limit' then 20      -- ثانية لكل سؤال
    when 'grace' then 2            -- سماح لتأخر الشبكة
    when 'streak_from' then 3      -- مكافأة التتابع من الإجابة الصحيحة الثالثة المتتالية
    when 'streak_bonus' then 5
    when 'promote_rounds' then 3   -- جولات متتالية بدقة 80% فأكثر للترقية
    when 'report_threshold' then 3 -- بلاغات مفتوحة توقف السؤال المنشور
  end
$$;

create function public.base_points(d public.difficulty) returns integer
language sql immutable as $$
  select case d when 'beginner' then 10 when 'intermediate' then 20 else 30 end
$$;

create function public.require_player() returns public.players
language plpgsql stable security definer set search_path = public as $$
declare p public.players;
begin
  select * into p from public.players where id = auth.uid();
  if not found then
    raise exception 'سجّل اسمك للبدء';
  end if;
  return p;
end $$;

-- ٤) التسجيل
create function public.register_player(name text) returns public.players
language plpgsql security definer set search_path = public as $$
declare
  p public.players;
  clean text := regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception 'سجّل الدخول أولًا';
  end if;
  if char_length(clean) not between 2 and 24 then
    raise exception 'الاسم من حرفين إلى 24 حرفًا';
  end if;
  insert into public.players (id, display_name) values (auth.uid(), clean)
  on conflict (id) do update set display_name = excluded.display_name
  returning * into p;
  return p;
end $$;

-- ٥) بدء جولة: أسئلة منشورة بمستوى اللاعب، ويُقدَّم ما لم يره في آخر 30 يومًا.
create function public.start_round(p_category smallint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.players := public.require_player();
  r_id uuid;
  ids uuid[];
  n integer;
begin
  if p_category is not null and not exists (select 1 from public.categories where id = p_category) then
    raise exception 'تصنيف غير معروف';
  end if;

  select array_agg(x.id) into ids from (
    select q.id
    from public.questions q
    where q.status = 'published'
      and q.difficulty = p.level
      and (p_category is null or q.category_id = p_category)
    order by exists (
      select 1 from public.round_questions rq join public.rounds r on r.id = rq.round_id
      where rq.question_id = q.id and r.player_id = p.id and r.started_at > now() - interval '30 days'
    ), random()
    limit public.game_rule('round_size')
  ) x;

  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then
    raise exception 'لا توجد أسئلة منشورة بعد في هذا الاختيار';
  end if;

  insert into public.rounds (player_id, category_id, level, question_count)
  values (p.id, p_category, p.level, n) returning id into r_id;
  insert into public.round_questions (round_id, position, question_id)
  select r_id, t.ord, t.id from unnest(ids) with ordinality as t(id, ord);

  return jsonb_build_object('round_id', r_id, 'question_count', n, 'level', p.level, 'time_limit', public.game_rule('time_limit'));
end $$;

create function public.owned_round(p_round uuid) returns public.rounds
language plpgsql stable security definer set search_path = public as $$
declare r public.rounds;
begin
  select * into r from public.rounds where id = p_round and player_id = auth.uid();
  if not found then
    raise exception 'الجولة غير موجودة';
  end if;
  return r;
end $$;

create function public.media_json(q_id uuid, p_placement public.media_placement) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('kind', kind, 'url', url, 'start', start_seconds, 'end', end_seconds, 'alt', alt_text)
  from public.question_media where question_id = q_id and placement = p_placement
$$;

-- مهلة إضافية قبل بدء العدّاد في السؤال المرئي: طول اللقطة إن عُرف.
create function public.clip_seconds(q_id uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when kind = 'video' and start_seconds is not null and end_seconds is not null
                then end_seconds - start_seconds else 0 end
    from public.question_media where question_id = q_id and placement = 'question'
  ), 0)
$$;

-- ٦) عرض السؤال التالي (دون الإجابة). إعادة الطلب لا تعيد العدّاد.
create function public.show_question(p_round uuid, p_position smallint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.rounds := public.owned_round(p_round);
  rq public.round_questions;
  q public.questions;
  next_pos smallint;
  opts jsonb;
begin
  if r.finished_at is not null then
    raise exception 'انتهت هذه الجولة';
  end if;
  select min(position) into next_pos from public.round_questions where round_id = r.id and answered_at is null;
  if next_pos is null or p_position <> next_pos then
    raise exception 'أجب عن السؤال الحالي أولًا';
  end if;

  update public.round_questions set shown_at = coalesce(shown_at, now())
  where round_id = r.id and position = p_position returning * into rq;
  select * into q from public.questions where id = rq.question_id;

  -- عناصر الترتيب تُرسل مخلوطة، والخيارات الأخرى كما هي.
  opts := case when q.type = 'ordering'
    then (select jsonb_agg(v order by random()) from jsonb_array_elements(q.options) v)
    else q.options end;

  return jsonb_build_object(
    'position', rq.position,
    'question_count', r.question_count,
    'question_id', q.id,
    'type', q.type,
    'prompt', q.prompt,
    'options', opts,
    'media', public.media_json(q.id, 'question'),
    'time_limit', public.game_rule('time_limit'),
    'timer_delay', public.clip_seconds(q.id),
    'score', r.score
  );
end $$;

-- ٧) الإجابة: التصحيح والوقت والنقاط على الخادم.
create function public.answer_question(p_round uuid, p_position smallint, p_answer jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.rounds := public.owned_round(p_round);
  rq public.round_questions;
  q public.questions;
  elapsed numeric;
  limit_s integer := public.game_rule('time_limit');
  late boolean;
  correct boolean;
  streak integer := 0;
  pts integer := 0;
  base integer;
begin
  if r.finished_at is not null then
    raise exception 'انتهت هذه الجولة';
  end if;
  select * into rq from public.round_questions where round_id = r.id and position = p_position for update;
  if not found or rq.shown_at is null then
    raise exception 'لم يُعرض هذا السؤال بعد';
  end if;
  if rq.answered_at is not null then
    raise exception 'أُجيب عن هذا السؤال من قبل';
  end if;
  select * into q from public.questions where id = rq.question_id;

  elapsed := greatest(0, extract(epoch from now() - rq.shown_at) - public.clip_seconds(q.id));
  late := elapsed > limit_s + public.game_rule('grace');

  correct := not late and p_answer is not null and case q.type
    when 'ordering' then p_answer = q.options
    else p_answer = q.correct_answer
  end;

  if correct then
    -- طول التتابع بعد هذه الإجابة: عدد الإجابات الصحيحة المتتالية التي تسبقها مباشرة + 1
    select count(*) + 1 into streak from public.round_questions x
    where x.round_id = r.id and x.position < p_position
      and x.position > coalesce((select max(y.position) from public.round_questions y
                                 where y.round_id = r.id and y.position < p_position and y.is_correct is not true), 0);
    base := public.base_points(q.difficulty);
    pts := base
      + floor(base * 0.5 * greatest(0, limit_s - elapsed) / limit_s)::integer
      + case when streak >= public.game_rule('streak_from') then public.game_rule('streak_bonus') else 0 end;
  end if;

  update public.round_questions set answered_at = now(), answer = p_answer, is_correct = correct,
    timed_out = late or p_answer is null, points = pts
  where round_id = r.id and position = p_position;
  update public.rounds set score = score + pts, correct_count = correct_count + case when correct then 1 else 0 end
  where id = r.id returning * into r;

  return jsonb_build_object(
    'is_correct', correct,
    'timed_out', late or p_answer is null,
    'points', pts,
    'streak', streak,
    'score', r.score,
    'correct_answer', q.correct_answer,
    'options', q.options,
    'benefit', q.benefit,
    'source', jsonb_build_object('book', q.source_book, 'volume', q.source_volume, 'page', q.source_page),
    'media', public.media_json(q.id, 'answer'),
    'is_last', p_position = r.question_count
  );
end $$;

-- ٨) إنهاء الجولة والترقية التلقائية.
create function public.finish_round(p_round uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.rounds := public.owned_round(p_round);
  p public.players := public.require_player();
  promoted public.difficulty;
  qualifying integer;
begin
  if r.finished_at is null then
    update public.round_questions set answered_at = now(), is_correct = false, timed_out = true, points = 0
    where round_id = r.id and answered_at is null;
    update public.rounds set finished_at = now() where id = r.id returning * into r;

    if p.level <> 'advanced' and r.level = p.level then
      select count(*) into qualifying from (
        select correct_count::numeric / question_count >= 0.8 as good
        from public.rounds
        where player_id = p.id and level = p.level and finished_at is not null
        order by finished_at desc
        limit public.game_rule('promote_rounds')
      ) last where good;
      if qualifying = public.game_rule('promote_rounds') then
        promoted := case p.level when 'beginner' then 'intermediate'::public.difficulty else 'advanced'::public.difficulty end;
        update public.players set level = promoted where id = p.id;
      end if;
    end if;
  end if;

  return jsonb_build_object('score', r.score, 'correct', r.correct_count, 'total', r.question_count, 'promoted_to', promoted);
end $$;

-- ٩) لوحات المتصدرين: أسبوعية (تبدأ الجمعة بتوقيت مكة)، وتراكمية، ولكل تصنيف.
create function public.week_start() returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone 'Asia/Riyadh')
          - (((extract(dow from now() at time zone 'Asia/Riyadh'))::integer - 5 + 7) % 7) * interval '1 day')
         at time zone 'Asia/Riyadh'
$$;

create function public.leaderboard(p_kind text default 'weekly', p_category smallint default null, p_limit integer default 50)
returns table (rank bigint, display_name text, points bigint, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind not in ('weekly', 'all_time') then
    raise exception 'نوع لوحة غير معروف';
  end if;
  return query
  with totals as (
    select r.player_id, sum(r.score)::bigint as pts
    from public.rounds r
    where r.finished_at is not null
      and (p_kind = 'all_time' or r.finished_at >= public.week_start())
      and (p_category is null or r.category_id = p_category)
    group by r.player_id
    having sum(r.score) > 0
  ), ranked as (
    select rank() over (order by t.pts desc) as rnk, pl.display_name as name, t.pts, t.player_id = auth.uid() as me
    from totals t join public.players pl on pl.id = t.player_id
  )
  select rnk, name, pts, me from ranked
  where rnk <= least(greatest(p_limit, 1), 100) or me
  order by rnk, name;
end $$;

-- ١٠) البلاغات: لا يُبلَّغ إلا عن سؤال عُرض على اللاعب، وتكرارها يوقف السؤال المنشور.
create function public.report_question(p_question uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.players := public.require_player();
  open_reports integer;
begin
  if not exists (
    select 1 from public.round_questions rq join public.rounds r on r.id = rq.round_id
    where rq.question_id = p_question and r.player_id = p.id and rq.shown_at is not null
  ) then
    raise exception 'لا يمكن الإبلاغ إلا عن سؤال ظهر لك';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'اكتب سبب البلاغ';
  end if;

  insert into public.question_reports (question_id, player_id, reason)
  values (p_question, p.id, left(trim(p_reason), 500))
  on conflict (question_id, player_id) do update set reason = excluded.reason, created_at = now(), resolved_at = null;

  select count(*) into open_reports from public.question_reports
  where question_id = p_question and resolved_at is null;
  if open_reports >= public.game_rule('report_threshold') then
    perform set_config('app.in_transition', 'on', true);
    update public.questions set status = 'suspended',
      review_notes = format('أُوقف آليًا بعد %s بلاغات من اللاعبين', open_reports)
    where id = p_question and status = 'published';
    perform set_config('app.in_transition', 'off', true);
  end if;
end $$;

-- ١١) إحصاءات السؤال للفريق، واقتراح إعادة المعايرة.
create function public.question_stats(p_question uuid)
returns table (answers bigint, correct bigint, correct_rate numeric, open_reports bigint, suggested_level public.difficulty)
language plpgsql stable security definer set search_path = public as $$
declare d public.difficulty;
begin
  if public.my_role() is null then
    raise exception 'للفريق فقط';
  end if;
  select difficulty into d from public.questions where id = p_question;
  return query
  with s as (
    select count(*) filter (where answered_at is not null) as n,
           count(*) filter (where is_correct) as c
    from public.round_questions where question_id = p_question
  )
  select s.n, s.c,
    case when s.n > 0 then round(s.c::numeric / s.n, 2) end,
    (select count(*) from public.question_reports where question_id = p_question and resolved_at is null),
    case
      when s.n >= 30 and s.c::numeric / s.n >= 0.9 and d = 'advanced' then 'intermediate'::public.difficulty
      when s.n >= 30 and s.c::numeric / s.n >= 0.9 and d = 'intermediate' then 'beginner'::public.difficulty
      when s.n >= 30 and s.c::numeric / s.n <= 0.3 and d = 'beginner' then 'intermediate'::public.difficulty
      when s.n >= 30 and s.c::numeric / s.n <= 0.3 and d = 'intermediate' then 'advanced'::public.difficulty
    end
  from s;
end $$;

-- ١٢) الصلاحيات: الدوال الداخلية لا تُستدعى مباشرة، ودوال اللعب للمسجَّلين فقط.
revoke execute on function public.require_player(), public.owned_round(uuid), public.media_json(uuid, public.media_placement),
  public.clip_seconds(uuid) from public, anon, authenticated;
revoke execute on function public.register_player(text), public.start_round(smallint), public.show_question(uuid, smallint),
  public.answer_question(uuid, smallint, jsonb), public.finish_round(uuid), public.leaderboard(text, smallint, integer),
  public.report_question(uuid, text), public.question_stats(uuid) from public, anon;
