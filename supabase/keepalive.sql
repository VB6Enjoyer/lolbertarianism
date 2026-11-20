-- Applied to the lolbertarianism Supabase project (migration "keepalive_table"). A one-row table
-- that .github/workflows/supabase-keepalive.yml reads every three days, so the free project never
-- goes a week without activity and never gets paused. Readable by anyone, writable by nobody.
-- Online party mode itself only uses Realtime; it doesn't touch any table.
create table if not exists public.keepalive (
  id smallint primary key default 1 check (id = 1),
  note text not null default 'Read every few days by .github/workflows/supabase-keepalive.yml'
);
insert into public.keepalive (id) values (1) on conflict (id) do nothing;
alter table public.keepalive enable row level security;
revoke insert, update, delete, truncate on public.keepalive from anon, authenticated;
grant select on public.keepalive to anon, authenticated;
create policy "anyone can read the keepalive row" on public.keepalive for select to anon, authenticated using (true);
