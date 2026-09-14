# Auditoría técnica externa — Morelia Finanzas

Fecha: 14 de septiembre de 2026. Evaluación del árbol de trabajo actual, incluidos cambios locales preexistentes. No se modificó código de aplicación ni se accedió a datos de producción.

## Dictamen

La aplicación tiene una base modular aprovechable y buenas pruebas de cierres y conflictos de períodos. Sin embargo, no recomiendo aprobarla todavía para uso financiero confiable entre varias cuentas y dispositivos: hay defectos de aislamiento local, persistencia y coherencia con la base de datos. Una compilación correcta no demuestra que el dinero registrado quede guardado o sincronizado.

## Alcance y evidencia

- Inspección de arranque, autenticación, almacenamiento, CRUD, sincronización, exportación, SQL, despliegue y PWA.
- `npm test`: 44 pruebas aprobadas, ninguna fallida.
- `npm run build`: correcto, incluido postbuild y generación de precache.
- `npm audit --json`: cero vulnerabilidades conocidas reportadas. Esto no certifica la seguridad del código propio.
- Reproducción aislada en Node, usando los módulos reales de estado y almacenamiento, de la creación de una copia global al cerrar sesión.
- No se verificaron la base de datos desplegada, permisos efectivos, correos reales, dos dispositivos reales ni accesibilidad visual en navegador. Los hallazgos SQL se refieren al esquema versionado; el servidor puede diferir.

## Hallazgos prioritarios

### A1 — Alta: movimientos de una cuenta pueden aparecer en otra

Evidencia: `src/js/modules/auth.js`, función `limpiarSesionAuth`; `src/js/app.js`, funciones `setupStateSubscribers` y `cargarMovimientosLocales`.

Cerrar sesión cambia el alcance del almacenamiento a global y emite un cambio de estado sin vaciar las transacciones. El suscriptor escribe entonces los movimientos del usuario anterior en `misfinanzas_data_transactions`. Una cuenta sin respaldo propio carga esa misma clave mediante la migración antigua, sin comprobar propietario. No necesita una colisión de identificadores.

Reproducción aislada: con cuenta A y un movimiento ficticio, ejecutar la secuencia de cierre dejó ese movimiento en la clave global. Al seleccionar B, su respaldo era nulo y el fallback global contenía el movimiento de A. En modo local la copia permanece; con nube puede mostrarse antes de adoptar el estado remoto o durante un fallo de conexión. No se afirma acceso cruzado a filas de Supabase.

Corrección: vaciar el estado financiero con persistencia suspendida antes de retirar el alcance; impedir escrituras financieras sin propietario y convertir la migración antigua en una operación explícita de una sola vez. Validación: A registra, sale y B entra sin datos; B debe permanecer vacío tanto offline como con nube.

### A2 — Alta: el CRUD envía una columna que el esquema no define

Evidencia: `src/js/modules/transactions.js:59`, `src/js/supabase.js:74`, `database/schema.sql:40`.

Cada registro generado por el formulario incluye `timestamp`, y la sincronización lo incluye en INSERT/UPDATE. El SQL versionado define `created_at`, pero no `timestamp`; no se encontró una migración que lo añada. Un despliegue construido con ese SQL rechazará esos payloads y mantendrá operaciones pendientes. Las pruebas usan un transporte simulado que acepta cualquier propiedad y no detectan esta incompatibilidad.

Corrección: acordar un único contrato de columnas y migrarlo; distinguir fecha de creación de fecha de modificación. Validación: crear una base desde los archivos versionados y ejecutar un alta y una edición con el payload real del formulario. Comprobar también el esquema efectivo antes de atribuir este fallo a producción.

### A3 — Alta: un fallo de almacenamiento puede presentarse como guardado correcto

Evidencia: `src/js/storage.js`, `guardarEnStorage`; `src/js/app.js:492`; `src/js/supabase.js`, `guardarPendientes` y `guardarOperacionPendiente`; `src/js/modules/transactions.js`, `guardarRegistro`.

El almacenamiento captura errores y devuelve `false`, pero sus llamadores ignoran ese resultado. Si falla la escritura de la cola, la comprobación de ausencia del token puede interpretarla como una operación guardada. El CRUD muestra éxito y limpia el formulario aunque no se haya conservado una copia durable. Con cuota agotada y sin conexión, recargar puede perder el movimiento.

Corrección: propagar los errores y confirmar éxito solamente tras persistir; conservar el formulario cuando no existe ninguna copia durable. Validación: simular `QuotaExceededError` y desconexión y comprobar que no aparece éxito ni se pierde el contenido editable.

### A4 — Alta: reiniciar datos no garantiza el borrado anunciado

Evidencia: `src/js/app.js:439`, `src/js/supabase.js`, `borrarTransaccionesSupabase`; `src/js/storage.js`, `limpiarDatosFinancierosStorage`.

El reinicio ignora el resultado del borrado remoto, vacía movimientos y pendientes locales y anuncia éxito. La función remota incluso devuelve éxito si no considera la conexión activa. Al reconectar, los movimientos remotos conservados pueden reaparecer, mientras que operaciones locales pendientes se han descartado. Los lotes remotos tampoco son una operación atómica.

Corrección: definir un reinicio recuperable por cuenta, conservar las operaciones de borrado hasta confirmación y distinguir estado pendiente de finalizado. Validación: reiniciar sin conexión y con un fallo entre lotes; reconectar y comprobar un resultado coherente para movimientos, ahorro e historial.

### A5 — Media: recuperación de contraseña incompleta

Evidencia: `src/js/modules/auth.js:592` y búsqueda en todo `src` de `reset-password`, `PASSWORD_RECOVERY` y `updateUser`.

Se envía un enlace que vuelve con `?reset-password=true`, pero no existe un manejador de esa ruta o evento, formulario de nueva contraseña ni llamada para actualizarla. La única llamada `updateUser` actualiza el nombre del perfil. El usuario puede recibir un enlace sin poder establecer una nueva contraseña desde la aplicación.

Corrección: completar la vista y manejo de sesión de recuperación. Validación: recorrer envío, enlace, cambio, cierre de sesión y acceso con la nueva contraseña; probar también un enlace vencido.

### A6 — Media: no existe un respaldo completo restaurable desde la aplicación

Evidencia: `src/js/modules/export.js`, `exportarJSON`; `src/js/storage.js`, `exportarBackup` e `importarBackup`; enlaces de exportación en `src/js/app.js`.

La exportación JSON omite deuda, configuración y límites del período, categorías y presupuestos; además rechaza exportar cuando no hay transacciones aunque existan ahorros o historial. No está conectada a la interfaz principal, que expone CSV/PDF. Las funciones genéricas de backup tampoco tienen un flujo de restauración conectado: recopilan claves de todas las cuentas y omiten el período almacenado bajo otro prefijo. No deben presentarse como recuperación completa del usuario actual.

Corrección: un formato versionado por cuenta, con validación e importación explícita de todos los datos financieros, excluyendo sesiones y hashes de contraseñas. Validación: exportar y restaurar en almacenamiento vacío y comparar movimientos, períodos, deuda, ahorro, categorías y presupuestos.

### A7 — Media: recursos PWA y actualización de caché inconsistentes

Evidencia: `public/manifest.webmanifest`, `public/sw.js`, `scripts/inject-sw-precache.mjs` y archivos existentes en `public/icons`.

El manifiesto y el service worker solicitan `/icons/icon-192.png`, eliminado en el árbol actual; el archivo disponible se llama `icon-1923.png`. También se precachea `/manifest.json`, que ya no existe en esa ubicación. Esto afecta esos recursos, sin implicar necesariamente que falle toda la instalación.

Además, el identificador del build se calcula con la lista de rutas y no su contenido. Cambiar exclusivamente una plantilla o imagen con nombre estable no cambia el service worker generado y no garantiza renovar su precache. Una actualización solo de recursos públicos puede dejar una instalación offline con versiones anteriores.

Corrección: validar referencias contra la salida y calcular la versión con hashes del contenido. Validación: cambiar solo una plantilla y confirmar que cambia el service worker; comprobar todos los recursos declarados y actualización offline.

### A8 — Media: la fecha inicial del formulario usa UTC

Evidencia: `src/js/app.js`, asignación `fechaInput.valueAsDate = new Date()` durante `initApp`.

El control de fecha interpreta `valueAsDate` como fecha UTC. En America/Sao_Paulo, después de las 21:00 puede iniciar con el día siguiente. Un registro cerca del cierre puede asignarse al período equivocado. Después de guardar se usa `obtenerFechaHoy`, por lo que hay dos criterios diferentes.

Corrección: usar la misma fecha civil local en arranque y después de guardar. Validación: abrir a las 23:30 locales del día de cierre y verificar que el registro conserva ese día.

## Mantenibilidad y controles positivos

Las políticas versionadas filtran por propietario y restringen cuentas anónimas; las funciones SQL revisadas usan `SECURITY INVOKER`. Esto es consistente con la separación entre permisos y RLS de la [documentación oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), aunque su presencia en archivos no demuestra su aplicación en producción.

Hay control de revisión para períodos, preservación de ediciones durante el envío, pruebas de límites de fechas, escape HTML en reportes y neutralización de fórmulas CSV. Son bases útiles para corregir los defectos sin rehacer el proyecto.

La batería actual se concentra en lógica financiera y transportes simulados. Faltan comprobaciones de contrato contra SQL real y de recorridos de autenticación, reinicio y persistencia fallida. El README también debe actualizarse: anuncia Node 16+, describe funcionalidades ya implementadas como futuras y presenta el respaldo con más garantías de las verificadas.

## Orden recomendado

1. Resolver A1–A4 antes de ampliar el uso con datos reales; añadir las reproducciones descritas como regresiones.
2. Completar recuperación y respaldo restaurable, y corregir fecha/PWA.
3. Crear un entorno reproducible desde migraciones y verificar CRUD/RLS con dos cuentas, sincronización con dos sesiones y reinicio ante fallos.
4. Realizar una segunda pasada de interfaz móvil, accesibilidad, instalación y actualización offline. Esa revisión visual queda fuera de la evidencia obtenida aquí.

La auditoría identifica problemas concretos del repositorio; no constituye una certificación de producción ni una prueba de intrusión.
