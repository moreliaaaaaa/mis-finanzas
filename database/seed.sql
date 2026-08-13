-- ============================================================
-- seed.sql
-- Datos de ejemplo para desarrollo (Supabase)
-- Requiere un usuario autenticado; asigna sus transacciones al primer usuario.
-- ============================================================

-- Solo insertar si no hay datos (evita duplicados)
do $$
declare
    v_user_id uuid;
begin
    -- Tomar el primer usuario disponible (en producción usar el ID real)
    select id into v_user_id from auth.users limit 1;

    if v_user_id is null then
        raise notice 'No hay usuarios registrados. Crea un usuario primero.';
        return;
    end if;

    if not exists (select 1 from public.transacciones where user_id = v_user_id limit 1) then
        insert into public.transacciones (user_id, tipo, categoria, monto, fecha, detalle) values
            (v_user_id, 'ingreso', 'ingreso_general', 120000, current_date - interval '8 days', 'Venta de vestidos de fiesta'),
            (v_user_id, 'egreso', 'hilos_taller', 15000, current_date - interval '7 days', 'Hilos Overlock de colores'),
            (v_user_id, 'egreso', 'arriendo', 50000, current_date - interval '18 days', 'Pago Arriendo Taller'),
            (v_user_id, 'egreso', 'salidas_familia', 22000, current_date - interval '6 days', 'Almuerzo familiar fin de semana'),
            (v_user_id, 'egreso', 'gastos_ninos', 12000, current_date - interval '5 days', 'Materiales escolares para los niños');

        raise notice 'Datos de ejemplo insertados para el usuario %', v_user_id;
    end if;
end $$;
