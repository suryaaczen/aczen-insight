-- Phase 2: shareable conversations + auth-aware RLS.
-- Replaces the Phase 1 permissive policies with:
--   * Owner-only access for signed-in users (auth.uid() = user_id)
--   * Legacy anonymous access for rows where user_id is null
--   * Public read of rows whose share_token is set (token == capability)

alter table public.conversations
  add column if not exists share_token text unique;

create index if not exists conversations_share_token_idx
  on public.conversations(share_token) where share_token is not null;

-- Drop Phase 1 permissive policies.
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

-- Claim anonymous chats on first sign-in: re-keys conversations from
-- session_id ownership to user_id ownership. Idempotent.
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
