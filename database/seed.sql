-- ============================================================
-- seed.sql
-- Datos de ejemplo para desarrollo (Supabase)
--
-- Este archivo toma un usuario existente de auth.users
-- y le asigna las transacciones de ejemplo.
--
-- IMPORTANTE:
-- Usar únicamente para desarrollo/pruebas.
-- ============================================================

do $$
declare
    v_user_id uuid;
begin

    -- --------------------------------------------------------
    -- 1. Obtener un usuario existente
    -- --------------------------------------------------------

    select id
    into v_user_id
    from auth.users
    order by created_at asc
    limit 1;


    -- --------------------------------------------------------
    -- 2. Comprobar que exista al menos un usuario
    -- --------------------------------------------------------

    if v_user_id is null then
        raise notice
            'No hay usuarios registrados. Crea un usuario antes de ejecutar seed.sql.';

        return;
    end if;


    -- --------------------------------------------------------
    -- 3. Evitar duplicar los datos de ejemplo
    -- --------------------------------------------------------

    if exists (
        select 1
        from public.transacciones
        where user_id = v_user_id
    ) then

        raise notice
            'El usuario % ya tiene transacciones. No se insertaron datos.',
            v_user_id;

        return;
    end if;


    -- --------------------------------------------------------
    -- 4. Insertar transacciones de ejemplo
    -- --------------------------------------------------------

    insert into public.transacciones (
        user_id,
        tipo,
        categoria,
        monto,
        fecha,
        detalle
    )
    values

        (
            v_user_id,
            'ingreso',
            'ingreso_general',
            120000,
            current_date - 8,
            'Venta de vestidos de fiesta'
        ),

        (
            v_user_id,
            'egreso',
            'hilos_taller',
            15000,
            current_date - 7,
            'Hilos Overlock de colores'
        ),

        (
            v_user_id,
            'egreso',
            'arriendo',
            50000,
            current_date - 18,
            'Pago Arriendo Taller'
        ),

        (
            v_user_id,
            'egreso',
            'salidas_familia',
            22000,
            current_date - 6,
            'Almuerzo familiar fin de semana'
        ),

        (
            v_user_id,
            'egreso',
            'gastos_ninos',
            12000,
            current_date - 5,
            'Materiales escolares para los niños'
        );


    -- --------------------------------------------------------
    -- 5. Confirmación
    -- --------------------------------------------------------

    raise notice
        'Datos de ejemplo insertados correctamente para el usuario %.',
        v_user_id;

end $$;
