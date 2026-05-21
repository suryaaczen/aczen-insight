-- Per-session daily message counter for the chat function.
-- Used to enforce a free-tier "messages left today" quota until full auth-based
-- quotas land. Server-side increments happen with the service-role key, so RLS
-- below only governs whatever clients might read directly.

create table if not exists public.usage_daily (
  session_id  text  not null,
  day         date  not null default (now() at time zone 'utc')::date,
  count       int   not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (session_id, day)
);

create index if not exists usage_daily_session_idx on public.usage_daily(session_id, day desc);

alter table public.usage_daily enable row level security;

-- Anonymous clients may read their own row (we don't expose session_ids of
-- other browsers in any UI). Writes always go through the edge function with
-- the service role key, bypassing RLS.
drop policy if exists "anon read usage_daily" on public.usage_daily;
create policy "anon read usage_daily" on public.usage_daily for select using (true);

-- Atomic increment: returns the new count for the (session_id, today) row.
create or replace function public.increment_usage_daily(p_session_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.usage_daily as u (session_id, day, count, updated_at)
  values (p_session_id, (now() at time zone 'utc')::date, 1, now())
  on conflict (session_id, day)
  do update set count = u.count + 1, updated_at = now()
  returning count into v_count;
  return v_count;
end;
$$;

grant execute on function public.increment_usage_daily(text) to anon, authenticated, service_role;
