# Sincronización entre PC y móvil

## Activación pendiente en Supabase

El proyecto configurado es `rostqhlbodfaijdgowog`. La conexión administrativa
disponible durante este cambio no tiene acceso a ese proyecto. Se confirmó por
la API que `transacciones` existe y `periodos_financieros` todavía no existe.

1. En el SQL Editor de **ese proyecto**, ejecutar una sola vez
   `supabase/migrations/20260906120022_sync_financial_periods.sql`.
   Crea una tabla de períodos y sus políticas de acceso por cuenta; no modifica
   ni elimina movimientos existentes.
2. Ejecutar `npm run build` y publicar el contenido actualizado de `dist/` en el
   alojamiento que usan ambos dispositivos.
3. Abrir primero la app actualizada en el dispositivo cuyo período se desea
   conservar. Su período será el inicial de la cuenta. Después abrir la app
   actualizada en el otro dispositivo, con la misma URL y cuenta.
4. Comparar las fechas del período y los movimientos. Con conexión, la app
   actualiza los datos al abrirse, al recuperar conexión, al volver a primer
   plano y cada 15 segundos mientras está visible.

Si la app instalada conserva una versión anterior, cerrarla y volver a abrirla
después de actualizar. No borrar el almacenamiento del navegador: podría
contener movimientos que aún no se han subido.

## Conservación de datos

- Los movimientos pendientes se guardan con su contenido antes de enviarlos.
  Una consulta fallida conserva el estado local y muestra un aviso.
- Una consulta exitosa vacía sí representa una cuenta sin movimientos; no
  restaura automáticamente movimientos eliminados desde otro dispositivo.
- Antes de la primera adopción de movimientos de la nube se conserva el
  respaldo `transactions_before_cloud_sync` en el almacenamiento por cuenta.
  Las copias locales antiguas sin operaciones pendientes no se suben a ciegas,
  porque podrían ser movimientos ya eliminados en la nube.
- Los períodos reemplazados se conservan en `period_backups`, por cuenta.
  Si dos dispositivos modifican la misma revisión, se conserva la versión
  compartida y se avisa del conflicto. El cierre no se suma dos veces.
- Los períodos vencidos se cierran automáticamente después de cargar los
  movimientos y el período compartido, sin operaciones pendientes de subir.
  En modo local se cierran con los datos del dispositivo.

## Cierre mensual

El día de cierre está incluido hasta medianoche local. Con cierre el día 4,
el inicio pasa al período **05/09–04/10** desde el 5 de septiembre, aunque el
período anterior siga pendiente de sincronización. Los movimientos del 4 y
anteriores dejan de sumar en las tarjetas del inicio. Al recuperar conexión,
se consolida el ahorro y el historial con los movimientos de la nube.

La comprobación se ejecuta al abrir la app, al volver a ella y cada 15 segundos
mientras está visible. Si hay varios meses vencidos, se archivan en orden.

Al cerrar el período, el saldo positivo se suma a los ahorros acumulados.
Los ingresos, gastos y balance del inicio se calculan únicamente con las fechas
del siguiente período: quedan en cero si todavía no tiene movimientos. Si ya
se registraron movimientos con fechas del nuevo período, se conservan y se
muestran; el cierre no borra registros.

En **Historial de periodos → Ver detalle** se conservan los totales del cierre,
el importe añadido al ahorro y una copia de cada movimiento (fecha, tipo,
categoría, detalle y monto). Los cierres antiguos que no guardaron esta copia
muestran los movimientos que todavía estén disponibles y lo indican en pantalla.

## Usar ahorro

En **Historial de periodos → Usar ahorro**, indicar monto, fecha y detalle.
La transferencia reduce el ahorro y aumenta el balance disponible del período;
el gasto se registra por separado y los ingresos no cambian.

Ejemplo: con $405.000 ahorrados y $200.000 de balance, registrar un gasto nuevo
de $350.000 deja el balance en -$150.000. Transferir $150.000 desde ahorro deja
$255.000 ahorrados y un balance de $0.

Los retiros se muestran junto al ahorro, en el detalle del período cerrado y
en las exportaciones. El cierre devuelve al ahorro el balance positivo que
quede, incluyendo dinero transferido y no gastado. Los retiros y el ahorro
restante se sincronizan en la misma fila de `periodos_financieros`, con control
de revisión. No requiere una migración SQL adicional.

## Validación

`npm test` comprueba adopción entre dispositivos, respaldo, conflictos de
revisión, ediciones durante el envío, errores de red y movimientos pendientes.
`npm run build` genera la aplicación y el precache.

Falta verificar con dos sesiones reales después de aplicar el SQL y publicar.
Esta corrección abarca períodos y movimientos; categorías y presupuestos
mantienen su implementación actual.

Referencia para las políticas: https://supabase.com/docs/guides/database/postgres/row-level-security
