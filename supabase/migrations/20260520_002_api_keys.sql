-- Phase 2 scaffold: developer API keys for programmatic access to Aczen.
-- The chat/letter edge functions will check `api_key` header against this table
-- once Phase 2 wiring is added. Keys are stored hashed (sha256) so the raw
-- secret only exists on the user's machine after creation.

create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  prefix        text not null,                       -- e.g. "ack_live_" + first 6 chars, shown in UI
  key_hash      text not null unique,                -- sha256(raw_key), never store raw
  scopes        text[] not null default '{chat,letter}',
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists api_keys_user_idx on public.api_keys(user_id);
create index if not exists api_keys_hash_idx on public.api_keys(key_hash);

alter table public.api_keys enable row level security;

-- Owner-only access. Raw key hash lookups happen server-side with the service
-- role key, bypassing RLS.
drop policy if exists "owner read keys"   on public.api_keys;
drop policy if exists "owner write keys"  on public.api_keys;
drop policy if exists "owner update keys" on public.api_keys;
drop policy if exists "owner delete keys" on public.api_keys;

create policy "owner read keys"   on public.api_keys for select using (auth.uid() = user_id);
create policy "owner write keys"  on public.api_keys for insert with check (auth.uid() = user_id);
create policy "owner update keys" on public.api_keys for update using (auth.uid() = user_id);
create policy "owner delete keys" on public.api_keys for delete using (auth.uid() = user_id);

-- Usage log so Phase 2 can show "Last used" + rate-limit later.
create table if not exists public.api_key_usage (
  id           bigserial primary key,
  api_key_id   uuid not null references public.api_keys(id) on delete cascade,
  endpoint     text not null,
  status_code  int  not null,
  tokens_used  int,
  created_at   timestamptz not null default now()
);

create index if not exists api_key_usage_key_idx on public.api_key_usage(api_key_id, created_at desc);

alter table public.api_key_usage enable row level security;

drop policy if exists "owner read usage" on public.api_key_usage;
create policy "owner read usage" on public.api_key_usage for select using (
  exists (select 1 from public.api_keys k where k.id = api_key_id and k.user_id = auth.uid())
);
