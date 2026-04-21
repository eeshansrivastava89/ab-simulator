-- Leaderboard RPCs for global cross-variant leaderboard page
-- Reads from posthog_events (source of truth for game completions)
-- 2026-04-20

-- ============================================================
-- 1. global_leaderboard: paginated player rankings
-- ============================================================
drop function if exists global_leaderboard(integer, integer, text, text, text);

create or replace function global_leaderboard(
  p_limit int default 50,
  p_offset int default 0,
  p_variant text default null,
  p_sort text default 'best_time',
  p_search text default null
)
returns table (
  rank bigint,
  username text,
  variant text,
  best_time numeric,
  avg_time numeric,
  games bigint,
  avg_guesses numeric,
  city text,
  country text,
  badges text[]
)
language sql
stable
as $$
  with completions as (
    select
      properties->>'username' as username,
      variant,
      completion_time_seconds as time_sec,
      total_guesses_count as guesses,
      properties->>'$geoip_city_name' as city,
      properties->>'$geoip_country_name' as country,
      timestamp as ts
    from posthog_events
    where event = 'puzzle_completed'
      and completion_time_seconds is not null
      and properties->>'username' is not null
  ),
  player_stats as (
    select
      username,
      variant,
      min(time_sec) as best_time,
      round(avg(time_sec), 2) as avg_time,
      count(*) as games,
      round(avg(guesses), 1) as avg_guesses,
      mode() within group (order by city) as city,
      mode() within group (order by country) as country
    from completions
    group by username, variant
  ),
  -- data-driven speed demon threshold: 10th percentile of all player best times
  speed_threshold as (
    select percentile_cont(0.10) within group (order by best_time) as cutoff
    from player_stats
  ),
  global_top10 as (
    select username, variant
    from (
      select
        username,
        variant,
        row_number() over (order by best_time asc nulls last) as global_rank
      from player_stats
    ) ranked_global
    where global_rank <= 10
  ),
  ranked as (
    select
      row_number() over (
        order by
          case when p_sort = 'best_time' then best_time end asc nulls last,
          case when p_sort = 'most_games' then games end desc nulls last,
          case when p_sort = 'avg_time' then avg_time end asc nulls last
      ) as rank_num,
      username,
      variant,
      best_time,
      avg_time,
      games,
      avg_guesses,
      city,
      country,
      case when best_time <= (select cutoff from speed_threshold) then array['speed_demon'] else array[]::text[] end ||
      case when games >= 10 then array['marathoner'] else array[]::text[] end ||
      case when games >= 50 then array['contributor'] else array[]::text[] end ||
      case when exists (
        select 1
        from global_top10 gt
        where gt.username = player_stats.username
          and gt.variant = player_stats.variant
      ) then array['top10'] else array[]::text[] end as badges
    from player_stats
    where (p_variant is null or variant = p_variant)
      and (p_search is null or username ilike '%' || p_search || '%')
  )
  select
    rank_num::bigint,
    username,
    variant,
    best_time,
    avg_time,
    games::bigint,
    avg_guesses,
    city,
    country,
    badges
  from ranked
  order by rank_num
  limit p_limit offset p_offset;
$$;


-- ============================================================
-- 2. leaderboard_summary: single-row hero stats
-- ============================================================
create or replace function leaderboard_summary()
returns jsonb
language sql
stable
as $$
  with completions as (
    select
      properties->>'username' as username,
      variant,
      completion_time_seconds as time_sec,
      total_guesses_count as guesses,
      properties->>'$geoip_city_name' as city,
      properties->>'$geoip_country_name' as country,
      timestamp as ts
    from posthog_events
    where event = 'puzzle_completed'
      and completion_time_seconds is not null
      and properties->>'username' is not null
  ),
  player_agg as (
    select
      username,
      min(time_sec) as best_time,
      count(*) as games,
      (select time_sec from completions c2 where c2.username = completions.username order by ts asc limit 1) as first_time
    from completions
    group by username
  ),
  hourly as (
    select extract(hour from ts at time zone 'UTC' at time zone 'America/Los_Angeles')::int as hour, count(*) as games
    from completions
    group by extract(hour from ts at time zone 'UTC' at time zone 'America/Los_Angeles')
  ),
  speed_threshold as (
    select percentile_cont(0.10) within group (order by best_time) as cutoff
    from player_agg
  ),
  top_city as (
    select city, country, count(*) as completions
    from completions
    where city is not null
    group by city, country
    order by count(*) desc
    limit 1
  )
  select jsonb_build_object(
    'total_games', (select count(*) from completions),
    'total_players', (select count(distinct username) from completions),
    'fastest_time', (select min(time_sec) from completions),
    'fastest_player', (select username from completions where time_sec = (select min(time_sec) from completions) limit 1),
    'most_games', (select max(games) from player_agg),
    'most_games_player', (select username from player_agg order by games desc limit 1),
    'cities', (select count(distinct city) from completions where city is not null),
    'countries', (select count(distinct country) from completions where country is not null),
    'top_city', (select jsonb_build_object('city', city, 'country', country, 'completions', completions) from top_city),
    'variant_split', (
      select jsonb_object_agg(variant, cnt)
      from (select variant, count(*) as cnt from completions group by variant) t
    ),
    'hourly_activity', (select jsonb_agg(jsonb_build_object('hour', hour, 'games', games) order by hour) from hourly),
    'avg_guesses', (select round(avg(guesses), 1) from completions where guesses is not null),
    'completion_rate', (
      select round(
        count(*) filter (where event = 'puzzle_completed')::numeric /
        nullif(count(*) filter (where event = 'puzzle_started'), 0)
      , 3)
      from posthog_events
      where event in ('puzzle_started', 'puzzle_completed')
    ),
    'repeat_rate', (
      select round(count(*) filter (where games > 1)::numeric / nullif(count(*), 0), 3)
      from player_agg
    ),
    'most_improved', (
      select jsonb_build_object('username', username, 'improvement', round(first_time - best_time, 2))
      from player_agg
      where games >= 2 and first_time > best_time
      order by first_time - best_time desc
      limit 1
    ),
    'speed_demon_threshold', (select round(cutoff::numeric, 2) from speed_threshold)
  );
$$;
