-- =====================================================================
-- Aczen — full schema bundle.
-- Paste this entire file into Supabase Studio → SQL Editor → Run.
-- Idempotent: safe to re-run if some pieces already exist.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 001: conversations + messages (chat history)
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  session_id    text,
  title         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists conversations_user_idx    on public.conversations(user_id);
create index if not exists conversations_session_idx on public.conversations(session_id);

create table if not exists public.messages (
  id              bigserial primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  sources         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conv_idx on public.messages(conversation_id, id);

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- ---------------------------------------------------------------------
-- 003: daily quota counter
-- ---------------------------------------------------------------------
create table if not exists public.usage_daily (
  session_id  text  not null,
  day         date  not null default (now() at time zone 'utc')::date,
  count       int   not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (session_id, day)
);

create index if not exists usage_daily_session_idx on public.usage_daily(session_id, day desc);

alter table public.usage_daily enable row level security;

drop policy if exists "anon read usage_daily" on public.usage_daily;
create policy "anon read usage_daily" on public.usage_daily for select using (true);

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

grant execute on function public.increment_usage_daily(text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 004: shareable conversations + auth-aware RLS
-- ---------------------------------------------------------------------
alter table public.conversations
  add column if not exists share_token text unique;

create index if not exists conversations_share_token_idx
  on public.conversations(share_token) where share_token is not null;

-- Drop any prior policies (both phase 1 and phase 2 names).
drop policy if exists "anon read conversations"   on public.conversations;
drop policy if exists "anon write conversations"  on public.conversations;
drop policy if exists "anon update conversations" on public.conversations;
drop policy if exists "anon read messages"        on public.messages;
drop policy if exists "anon write messages"       on public.messages;
drop policy if exists "convs select own or shared" on public.conversations;
drop policy if exists "convs insert any"           on public.conversations;
drop policy if exists "convs update own"           on public.conversations;
drop policy if exists "convs delete own"           on public.conversations;
drop policy if exists "msgs select via parent"     on public.messages;
drop policy if exists "msgs insert via parent"     on public.messages;
drop policy if exists "msgs delete via parent"     on public.messages;

create policy "convs select own or shared" on public.conversations
  for select using (
    (auth.uid() is not null and auth.uid() = user_id)
    or (user_id is null)
    or (share_token is not null)
  );

create policy "convs insert any" on public.conversations
  for insert with check (
    (auth.uid() is not null and auth.uid() = user_id)
    or (auth.uid() is null and user_id is null)
  );

create policy "convs update own" on public.conversations
  for update using (
    (auth.uid() is not null and auth.uid() = user_id)
    or (auth.uid() is null and user_id is null)
  );

create policy "convs delete own" on public.conversations
  for delete using (
    (auth.uid() is not null and auth.uid() = user_id)
    or (auth.uid() is null and user_id is null)
  );

create policy "msgs select via parent" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (
          (auth.uid() is not null and auth.uid() = c.user_id)
          or c.user_id is null
          or c.share_token is not null
        )
    )
  );

create policy "msgs insert via parent" on public.messages
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (
          (auth.uid() is not null and auth.uid() = c.user_id)
          or (auth.uid() is null and c.user_id is null)
        )
    )
  );

create policy "msgs delete via parent" on public.messages
  for delete using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (
          (auth.uid() is not null and auth.uid() = c.user_id)
          or (auth.uid() is null and c.user_id is null)
        )
    )
  );

create or replace function public.claim_session_conversations(p_session_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null or p_session_id is null or p_session_id = '' then
    return 0;
  end if;
  update public.conversations
     set user_id = auth.uid()
   where session_id = p_session_id
     and user_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.claim_session_conversations(text)
  to authenticated;

-- ---------------------------------------------------------------------
-- Sanity check: pick this and run it to confirm everything is in place.
-- It should return one row with two columns set to 't'.
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in ('conversations','messages','usage_daily')) = 3
    as schema_ok,
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'conversations'
       and column_name  = 'share_token'
  ) as share_token_ok;
