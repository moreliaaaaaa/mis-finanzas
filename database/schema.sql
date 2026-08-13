-- ============================================================
-- schema.sql
-- Esquema de base de datos para MisFinanzas (Supabase)
-- Tabla: transacciones
-- ============================================================

-- Extensión para UUID v4 (generación de IDs desde la BD)
create extension if not exists "pgcrypto";

-- Tabla principal de transacciones
create table if not exists public.transacciones (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    tipo        text not null check (tipo in ('ingreso', 'egreso')),
    categoria   text not null,
    monto       numeric(12, 2) not null check (monto > 0),
    fecha       date not null default current_date,
    detalle     text,
    timestamp   timestamptz not null default now(),
    created_at  timestamptz not null default now()
);

-- Índices para consultas frecuentes
create index if not exists idx_transacciones_user_id on public.transacciones (user_id);
create index if not exists idx_transacciones_fecha on public.transacciones (fecha);
create index if not exists idx_transacciones_tipo on public.transacciones (tipo);

-- Comentarios de columnas
comment on table public.transacciones is 'Movimientos financieros de usuarios';
comment on column public.transacciones.user_id is 'ID del usuario propietario (auth.uid())';
