-- AB Simulator experiment summary
-- Appended every 2 hours by the analysis notebook.
-- Each row is a snapshot of the experiment at that point in time.

create table if not exists ab_simulator_summary (
  id bigint generated always as identity primary key,
  status text not null,                -- significant, not_significant, inconclusive, error
  decision text not null,              -- one-line recommendation
  metrics jsonb not null,              -- [{label, value, delta, delta_direction, context}]
  raw_stats jsonb,                     -- raw numbers for meta-analysis
  warnings jsonb,                      -- string[]
  methodology text,
  power_analysis text,
  sample_size_a int,
  sample_size_b int,
  generated_at timestamptz not null default now()
);

-- RLS: anon can read, inserts go through RPC
alter table ab_simulator_summary enable row level security;

create policy "anon can read ab_simulator_summary"
  on ab_simulator_summary for select
  to anon
  using (true);

-- RPC for notebook to insert summaries (SECURITY DEFINER bypasses RLS)
create or replace function insert_ab_summary(
  p_status text,
  p_decision text,
  p_metrics jsonb,
  p_raw_stats jsonb default null,
  p_warnings jsonb default null,
  p_methodology text default null,
  p_power_analysis text default null,
  p_sample_size_a int default null,
  p_sample_size_b int default null
)
returns bigint
language sql
security definer
as $$
  insert into ab_simulator_summary (
    status, decision, metrics, raw_stats, warnings,
    methodology, power_analysis, sample_size_a, sample_size_b
  ) values (
    p_status, p_decision, p_metrics, p_raw_stats, p_warnings,
    p_methodology, p_power_analysis, p_sample_size_a, p_sample_size_b
  )
  returning id;
$$;
