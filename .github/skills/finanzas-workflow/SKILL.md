---
name: finanzas-workflow
description: 'Desarrolla y valida cambios en MisFinanzas. Úsala para modificar la aplicación Vite, plantillas HTML, JavaScript, CSS, sincronización Supabase, períodos financieros o funciones PWA, y para decidir qué pruebas y builds ejecutar.'
argument-hint: 'Describe el cambio que quieres implementar o revisar'
user-invocable: true
---

# Flujo de desarrollo de MisFinanzas

## Objetivo

Implementar cambios pequeños y verificables en esta aplicación financiera web, respetando sus fuentes, módulos, persistencia local, sincronización opcional con Supabase y comportamiento PWA.

## Cuándo usarla

- Crear o modificar una vista, flujo de transacciones, presupuesto o período financiero.
- Cambiar módulos JavaScript, estado, almacenamiento, sincronización o políticas de datos.
- Ajustar estilos responsive, navegación, gráficos o instalación offline.
- Revisar un cambio antes de darlo por terminado.

## Procedimiento

1. **Localiza el código propietario.** Empieza por el archivo, símbolo, prueba o error mencionado. Sigue la llamada hasta el módulo que decide el comportamiento. No edites `public/templates/`: las plantillas fuente viven en `src/templates/` y Vite genera las copias públicas.
2. **Formula una hipótesis local.** Resume qué ruta controla el comportamiento, qué debería cambiar y qué prueba barata podría refutarlo. Lee solo los vecinos necesarios: llamada, implementación y prueba relacionada.
3. **Comprueba los límites del cambio.**
   - Estado y persistencia: revisa `src/js/state.js` y `src/js/storage.js`.
   - Sincronización o autenticación: revisa los módulos correspondientes y la documentación de `docs/`.
   - Base de datos: trata `database/` y `supabase/migrations/` como contratos; no cambies políticas o esquema sin verificar el impacto en aislamiento de cuentas y sincronización.
   - Plantillas: edita únicamente `src/templates/`, mantén los HTML directamente en esa carpeta y conserva las rutas `/templates/`.
   - PWA: considera `public/sw.js`, `public/manifest.webmanifest` y el precache si agregas o renombras recursos.
4. **Haz la edición mínima.** Conserva las APIs públicas, el estilo modular ES y las convenciones existentes. Añade pruebas cuando el cambio altere lógica compartida, persistencia, sincronización, períodos o exportación.
5. **Valida inmediatamente.** Ejecuta primero el chequeo más estrecho que pueda refutar la hipótesis. Después amplía según el riesgo:
   - `npm test` para la suite de regresión.
   - `npm run build` para comprobar el bundle y la generación de copias de plantillas y precache.
   - `npm run dev` o `npm run preview` para comprobaciones manuales de UI/PWA cuando corresponda.
   - Usa los scripts de `output/playwright/` solo para flujos concretos que necesiten navegador y datos preparados.
6. **Revisa el resultado.** Comprueba que no se editaron salidas generadas innecesariamente, que las rutas siguen funcionando, que los estados vacío/carga/error están cubiertos y que la interfaz sigue siendo usable en móvil.

## Decisiones rápidas

| Cambio                              | Mínimo recomendado                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| Lógica pura o utilitaria            | Prueba específica y `npm test`                                                        |
| Vista, plantilla o CSS              | Build y comprobación responsive; añade prueba de navegador si el flujo es interactivo |
| Estado o LocalStorage               | Pruebas de persistencia, aislamiento y regresión                                      |
| Supabase, períodos o sincronización | Suite completa y revisión de migración/políticas                                      |
| Manifest, Service Worker o assets   | `npm run build`, revisión del precache y prueba de instalación/offline                |

## Criterios de terminado

- El cambio está en la fuente correcta y no depende de editar artefactos generados.
- La hipótesis inicial queda confirmada por una prueba o una validación ejecutable.
- `npm test` y/o `npm run build` pasan según el riesgo del cambio.
- No se rompen rutas, persistencia local, aislamiento de cuentas ni sincronización existente.
- La documentación se actualiza si cambian comandos, contratos de datos o comportamiento de usuario.
- Se informa explícitamente cualquier prueba no ejecutada y el riesgo residual.

## Prompts de ejemplo

- "Añade una validación al cierre de período y prueba los casos de fecha límite."
- "Cambia el encabezado de la vista de egresos; localiza la plantilla fuente y valida el build."
- "Revisa este cambio de sincronización buscando regresiones de aislamiento entre cuentas."
- "Actualiza un asset PWA y comprueba que el precache generado lo incluye."
