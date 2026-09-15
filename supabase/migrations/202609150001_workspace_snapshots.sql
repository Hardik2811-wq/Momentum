create table if not exists public.workspace_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_snapshots enable row level security;
revoke all on public.workspace_snapshots from anon, authenticated;
grant select, insert, update, delete on public.workspace_snapshots to authenticated;

create policy "Users read own workspace" on public.workspace_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own workspace" on public.workspace_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own workspace" on public.workspace_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own workspace" on public.workspace_snapshots for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger workspace_snapshots_set_updated_at before update on public.workspace_snapshots
for each row execute function public.set_updated_at();
