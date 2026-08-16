-- ============================================================
-- schema.sql
-- Esquema de base de datos para MisFinanzas (Supabase)
-- Tabla principal: transacciones
-- ============================================================


-- ------------------------------------------------------------
-- Extensión para generación de UUID
-- ------------------------------------------------------------

create extension if not exists "pgcrypto";


-- ------------------------------------------------------------
-- Tabla principal de transacciones
-- ------------------------------------------------------------

create table if not exists public.transacciones (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        default auth.uid()
        references auth.users(id)
        on delete cascade,

    tipo text not null
        check (tipo in ('ingreso', 'egreso')),

    categoria text not null,

    monto numeric(12, 2) not null
        check (monto > 0),

    fecha date not null
        default current_date,

    detalle text,

    created_at timestamptz not null
        default now()
);


-- ------------------------------------------------------------
-- Índices para consultas frecuentes
-- ------------------------------------------------------------

create index if not exists idx_transacciones_user_id
    on public.transacciones (user_id);

create index if not exists idx_transacciones_fecha
    on public.transacciones (fecha);

create index if not exists idx_transacciones_tipo
    on public.transacciones (tipo);

create index if not exists idx_transacciones_user_fecha
    on public.transacciones (user_id, fecha);


-- ------------------------------------------------------------
-- Comentarios
-- ------------------------------------------------------------

comment on table public.transacciones
    is 'Movimientos financieros de los usuarios de MisFinanzas';

comment on column public.transacciones.user_id
    is 'Usuario propietario de la transacción, asociado a auth.users.id';

comment on column public.transacciones.tipo
    is 'Tipo de movimiento: ingreso o egreso';

comment on column public.transacciones.categoria
    is 'Categoría financiera de la transacción';

comment on column public.transacciones.monto
    is 'Monto positivo de la transacción';

comment on column public.transacciones.fecha
    is 'Fecha efectiva del movimiento financiero';
