-- ============================================================
-- policies.sql
-- Políticas de Seguridad a Nivel de Fila (RLS)
-- Cada usuario solo puede acceder a SUS propias transacciones.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Habilitar RLS
-- ------------------------------------------------------------

alter table public.transacciones
enable row level security;


-- ------------------------------------------------------------
-- 2. Eliminar políticas anteriores si ya existen
-- Esto permite volver a ejecutar este archivo sin errores.
-- ------------------------------------------------------------

drop policy if exists "Usuarios ven sus transacciones"
    on public.transacciones;

drop policy if exists "Usuarios insertan transacciones"
    on public.transacciones;

drop policy if exists "Usuarios actualizan transacciones"
    on public.transacciones;

drop policy if exists "Usuarios eliminan transacciones"
    on public.transacciones;


-- ------------------------------------------------------------
-- 3. SELECT
-- El usuario solo puede leer sus propias transacciones
-- ------------------------------------------------------------

create policy "Usuarios ven sus transacciones"
    on public.transacciones
    for select
    to authenticated
    using (
        (select auth.uid()) = user_id
    );


-- ------------------------------------------------------------
-- 4. INSERT
-- Solo permite crear transacciones pertenecientes
-- al usuario autenticado
-- ------------------------------------------------------------

create policy "Usuarios insertan transacciones"
    on public.transacciones
    for insert
    to authenticated
    with check (
        (select auth.uid()) = user_id
    );


-- ------------------------------------------------------------
-- 5. UPDATE
-- Solo permite modificar sus propias transacciones
-- y evita cambiar user_id por el de otro usuario
-- ------------------------------------------------------------

create policy "Usuarios actualizan transacciones"
    on public.transacciones
    for update
    to authenticated
    using (
        (select auth.uid()) = user_id
    )
    with check (
        (select auth.uid()) = user_id
    );


-- ------------------------------------------------------------
-- 6. DELETE
-- Solo permite eliminar sus propias transacciones
-- ------------------------------------------------------------

create policy "Usuarios eliminan transacciones"
    on public.transacciones
    for delete
    to authenticated
    using (
        (select auth.uid()) = user_id
    );


-- ============================================================
-- Realtime
-- La tabla transacciones YA está agregada a supabase_realtime.
-- No es necesario volver a ejecutar:
--
-- alter publication supabase_realtime
-- add table public.transacciones;
-- ============================================================
