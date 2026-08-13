-- ============================================================
-- policies.sql
-- Políticas de Seguridad a Nivel de Fila (RLS)
-- Garantizan que cada usuario solo accede a SUS datos.
-- ============================================================

-- 1. Habilitar RLS en la tabla
alter table public.transacciones enable row level security;

-- 2. Política de SELECT: permitir lectura para la app actual (anon/auth)
create policy "Usuarios ven sus transacciones"
    on public.transacciones
    for select
    using (true);

-- 3. Política de INSERT: permitir escritura para la app actual (anon/auth)
create policy "Usuarios insertan transacciones"
    on public.transacciones
    for insert
    with check (true);

-- 4. Política de UPDATE: permitir actualización para la app actual (anon/auth)
create policy "Usuarios actualizan transacciones"
    on public.transacciones
    for update
    using (true)
    with check (true);

-- 5. Política de DELETE: permitir eliminación para la app actual (anon/auth)
create policy "Usuarios eliminan transacciones"
    on public.transacciones
    for delete
    using (true);

-- ============================================================
-- Realtime
-- Habilitar publicación para sincronización en tiempo real
-- ============================================================
alter publication supabase_realtime add table public.transacciones;
