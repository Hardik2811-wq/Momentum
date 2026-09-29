-- Remove plaintext provider keys from every persisted workspace snapshot.
update public.workspace_snapshots
set data = jsonb_set(data, '{settings}', coalesce(data->'settings', '{}'::jsonb) - 'groqApiKey')
where jsonb_typeof(data->'settings') = 'object'
  and (data->'settings') ? 'groqApiKey';

create table if not exists public.ai_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, window_start)
);

alter table public.ai_rate_limits enable row level security;
revoke all on public.ai_rate_limits from anon, authenticated;

create or replace function public.consume_ai_request()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_window timestamptz := date_trunc('hour', now());
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.ai_rate_limits (user_id, window_start, request_count)
  values (auth.uid(), current_window, 1)
  on conflict (user_id, window_start) do update
    set request_count = public.ai_rate_limits.request_count + 1
    where public.ai_rate_limits.request_count < 20;

  return found;
end;
$$;

revoke all on function public.consume_ai_request() from public;
grant execute on function public.consume_ai_request() to authenticated;

create table if not exists public.ai_byok_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_key text not null check (length(encrypted_key) between 32 and 4096),
  key_version smallint not null check (key_version between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_byok_credentials enable row level security;
revoke all on public.ai_byok_credentials from anon, authenticated;

create trigger ai_byok_credentials_set_updated_at
before update on public.ai_byok_credentials
for each row execute function public.set_updated_at();

create table if not exists public.ai_byok_audit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('credential_saved', 'credential_deleted', 'credential_rotated')),
  created_at timestamptz not null default now()
);

alter table public.ai_byok_audit_events enable row level security;
revoke all on public.ai_byok_audit_events from anon, authenticated;

create table if not exists public.ai_byok_change_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, window_start)
);

alter table public.ai_byok_change_limits enable row level security;
revoke all on public.ai_byok_change_limits from anon, authenticated;

create or replace function public.consume_byok_credential_change()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_window timestamptz := date_trunc('hour', now());
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.ai_byok_change_limits (user_id, window_start, request_count)
  values (auth.uid(), current_window, 1)
  on conflict (user_id, window_start) do update
    set request_count = public.ai_byok_change_limits.request_count + 1
    where public.ai_byok_change_limits.request_count < 5;

  return found;
end;
$$;

revoke all on function public.consume_byok_credential_change() from public;
grant execute on function public.consume_byok_credential_change() to authenticated;
