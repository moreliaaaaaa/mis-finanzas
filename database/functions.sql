-- ============================================================
-- functions.sql
-- Funciones útiles para MisFinanzas (Supabase)
-- ============================================================

-- Resumen financiero de un usuario en un rango de fechas
create or replace function public.resumen_financiero(
    fecha_desde date,
    fecha_hasta date
)
returns table (
    total_ingresos numeric,
    total_egresos numeric,
    balance numeric
)
language sql
security invoker
as $$
    select
        coalesce(sum(case when tipo = 'ingreso' then monto else 0 end), 0) as total_ingresos,
        coalesce(sum(case when tipo = 'egreso' then monto else 0 end), 0) as total_egresos,
        coalesce(sum(case when tipo = 'ingreso' then monto else -monto end), 0) as balance
    from public.transacciones
    where user_id = auth.uid()
      and fecha between fecha_desde and fecha_hasta;
$$;

-- Egresos agrupados por categoría (para gráfico donut)
create or replace function public.egresos_por_categoria(
    fecha_desde date,
    fecha_hasta date
)
returns table (
    categoria text,
    total numeric
)
language sql
security invoker
as $$
    select categoria, sum(monto) as total
    from public.transacciones
    where user_id = auth.uid()
      and tipo = 'egreso'
      and fecha between fecha_desde and fecha_hasta
    group by categoria
    order by total desc;
$$;
