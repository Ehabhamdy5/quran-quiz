-- خلط خيارات الاختيار من متعدد لكل لاعب، والتصحيح بحسب ترتيب العرض.
alter table public.round_questions add column option_order smallint[];

create or replace function public.show_question(p_round uuid, p_position smallint) returns jsonb
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

  select * into q from public.questions
  where id = (select question_id from public.round_questions where round_id = r.id and position = p_position);

  -- الخيارات تُخلط مرة واحدة لكل لاعب وتُحفظ، فلا يتعلم اللاعبون موضع الإجابة، ولا تتغير عند إعادة العرض.
  update public.round_questions set
    shown_at = coalesce(shown_at, now()),
    option_order = coalesce(option_order, case when q.options is not null and jsonb_typeof(q.options) = 'array' then
      (select array_agg(i::smallint order by random()) from generate_series(0, jsonb_array_length(q.options) - 1) i) end)
  where round_id = r.id and position = p_position returning * into rq;

  opts := case when rq.option_order is null then q.options
    else (select jsonb_agg(q.options -> o.i order by o.k) from unnest(rq.option_order) with ordinality as o(i, k)) end;

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

create or replace function public.answer_question(p_round uuid, p_position smallint, p_answer jsonb) returns jsonb
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

  -- رقم الخيار يصل بترتيب العرض، فيُرد إلى ترتيبه الأصلي قبل المقارنة.
  correct := not late and p_answer is not null and case
    when q.type = 'ordering' then p_answer = q.options
    when q.type in ('mcq', 'visual') then
      jsonb_typeof(p_answer) = 'number'
      and (p_answer #>> '{}')::numeric between 0 and coalesce(array_length(rq.option_order, 1), 0) - 1
      and to_jsonb(rq.option_order[(p_answer #>> '{}')::integer + 1]) = q.correct_answer
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
