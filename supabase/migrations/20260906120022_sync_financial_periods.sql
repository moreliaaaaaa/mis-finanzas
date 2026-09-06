-- Un estado financiero por cuenta. La revisión evita sobrescribir cambios
-- realizados desde otro dispositivo con una copia antigua.
create table public.periodos_financieros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  datos jsonb not null check (jsonb_typeof(datos) = 'object'),
  revision integer not null default 1 check (revision > 0)
);

alter table public.periodos_financieros enable row level security;
revoke all on public.periodos_financieros from public, anon, authenticated;
grant select, insert, update on public.periodos_financieros to authenticated;

create policy periodos_select on public.periodos_financieros
for select to authenticated
using ((select auth.uid()) = user_id
  and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true));

create policy periodos_insert on public.periodos_financieros
for insert to authenticated
with check ((select auth.uid()) = user_id
  and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true));

create policy periodos_update on public.periodos_financieros
for update to authenticated
using ((select auth.uid()) = user_id
  and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true))
with check ((select auth.uid()) = user_id
  and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true));
