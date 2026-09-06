# MisFinanzas - Control Inteligente de Finanzas

## Dónde editar las plantillas

Para activar la sincronización de períodos y movimientos entre dispositivos,
consulta [Sincronización](docs/Sincronizacion.md).

- Edita los HTML de las vistas en `src/templates/`.
- `public/templates/` contiene copias generadas: no edites esa carpeta.
- `npm run dev` y `npm run build` regeneran las copias automáticamente. Durante el desarrollo, guardar, crear o eliminar un HTML en `src/templates/` actualiza la copia y recarga la página.
- Mantén los archivos HTML directamente en `src/templates/`, sin subcarpetas.
- `dist/` es la salida de producción generada por Vite.

Las vistas siguen cargándose desde `/templates/`; no necesitas cambiar sus rutas.

Aplicación web moderna y responsive para gestionar ingresos, gastos del hogar y taller de costura. Construida con **CSS Puro**, **JavaScript Modular** y **Vite**.

## ✨ Características Principales

- ✅ **CRUD Completo** - Crear, leer, actualizar y eliminar transacciones
- ✅ **Dashboard Profesional** - Vista general de ingresos y egresos
- ✅ **Gráficos Interactivos** - Chart.js para visualización de datos
- ✅ **Modo Oscuro** - Tema adaptable a preferencia del sistema
- ✅ **Responsive** - Funciona perfectamente en móvil, tablet y desktop
- ✅ **Almacenamiento Local** - LocalStorage para persistencia offline
- ✅ **Integración Supabase** (Opcional) - Sincronización en la nube
- ✅ **Exportación CSV** - Descarga tus datos en formato CSV
- ✅ **Arquitectura Modular** - Código limpio y mantenible
- ✅ **CSS Puro** - Sin dependencias de frameworks CSS

## 🚀 Inicio Rápido

### Prerequisitos

- Node.js 16+
- npm o yarn

### Instalación

```bash
# 1. Clonar/Descargar el proyecto
cd misfinanzas

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env (opcional, solo si usarás Supabase)
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# 4. Iniciar servidor de desarrollo
npm run dev

# 5. Abrir en navegador
# http://localhost:3000
```

### Build para Producción

```bash
npm run build
# Los archivos compilados estarán en dist/
```

## 📱 PWA (Aplicación Web Instalable)

Este proyecto incluye soporte PWA listo para usar. Archivos principales:

- `public/manifest.webmanifest` — manifiesto con metadata y accesos directos.
- `public/sw.js` — Service Worker (precaching + runtime caching).
- `public/icons/` — iconos en varios tamaños (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`).
- `src/js/pwa.js` — registro del Service Worker y manejo del botón de instalación.
- `index.html` — referencia al `manifest.webmanifest` y botón de instalación (`#btn-instalar-pwa`).

Nota sobre prioridad móvil

Este proyecto está optimizado pensando principalmente en uso móvil. Se priorizó el diseño mobile-first: navegación compacta, targets táctiles más grandes, fuentes e inputs que evitan zoom en iOS, y optimizaciones PWA para instalación en dispositivo.

Recomendaciones rápidas para pruebas en móvil:

- Usar `npm run preview` y abrir la URL desde tu dispositivo móvil en la misma red local (o usar ngrok) para probar instalación y comportamiento offline.
- En Chrome móvil/Android: abrir DevTools remoto (Remote devices) o Lighthouse para audit móvil.
- En iOS: asegurar que los inputs tienen `font-size: 16px` para evitar zoom automático (ya aplicado en `src/styles/responsive.css`).

Cómo probar localmente:

```bash
# Desarrollo (https://localhost o http://localhost:5173 según tu Vite)
npm run dev

# Para probar el comportamiento de producción (recomendado):
npm run build
npm run preview
# Abrir la URL que te entrega "vite preview" (normalmente http://localhost:4173)
```

En Chrome/Edge: abre DevTools → Application → Manifest para comprobar que el manifiesto carga, y Service Workers → Update para probar el SW. Para instalar, usa el botón de instalación o el menú del navegador.

Cómo forzar actualización del SW:

- Actualiza `CACHE_NAME` en `public/sw.js` (p. ej. `misfinanzas-v3`) y vuelve a desplegar.
- El Service Worker implementa un `message` handler que acepta `{ type: 'SKIP_WAITING' }` para forzar `skipWaiting`.

Notas:

- Asegúrate de servir la app en `localhost` o sobre HTTPS para que la instalación funcione.
- Los iconos que aparezcan en el manifiesto deben existir en `public/icons/`.

## 📁 Estructura del Proyecto

```
MisFinanzas/
├── index.html                 # Punto de entrada HTML
├── package.json              # Dependencias del proyecto
├── vite.config.js            # Configuración de Vite
├── .env.example              # Template de variables de entorno
├── .gitignore               # Archivos a ignorar en Git
│
├── src/
│   ├── assets/              # Recursos estáticos
│   │   ├── logo.svg
│   │   ├── icons/
│   │   ├── images/
│   │   └── fonts/
│   │
│   ├── styles/              # Estilos CSS modulares
│   │   ├── main.css         # Variables globales y reset
│   │   ├── dashboard.css    # Dashboard y componentes principales
│   │   ├── forms.css        # Inputs y formularios
│   │   ├── charts.css       # Gráficos y visualizaciones
│   │   ├── toast.css        # Notificaciones flotantes
│   │   └── responsive.css   # Media queries
│   │
│   └── js/                  # JavaScript modular (ES6)
│       ├── app.js           # Orquestación principal
│       ├── config.js        # Configuración y variables
│       ├── constants.js     # Categorías y constantes
│       ├── state.js         # Gestión del estado global
│       ├── utils.js         # Funciones utilitarias
│       ├── ui.js            # Funciones de UI
│       ├── storage.js       # LocalStorage
│       ├── supabase.js      # Cliente Supabase
│       │
│       └── modules/         # Módulos de funcionalidad
│           ├── dashboard.js # Lógica del dashboard
│           ├── transactions.js # CRUD de transacciones
│           ├── charts.js    # Gestión de gráficos
│           └── export.js    # Exportación de datos
│
├── database/                # Archivos SQL
│   ├── schema.sql
│   ├── policies.sql
│   ├── functions.sql
│   └── seed.sql
│
└── docs/                    # Documentación
    ├── ManualProyecto.pdf
    ├── BaseDatos.md
    ├── Roadmap.md
    └── Changelog.md
```

## 🎨 Tecnologías Utilizadas

| Tecnología              | Propósito                |
| ----------------------- | ------------------------ |
| **HTML5**               | Markup semántico         |
| **CSS Puro**            | Estilos sin frameworks   |
| **JavaScript ES6+**     | Programación modular     |
| **Vite**                | Bundler y dev server     |
| **Chart.js**            | Gráficos interactivos    |
| **Supabase** (Opcional) | Base de datos en la nube |
| **LocalStorage**        | Almacenamiento local     |
| **Lucide Icons**        | Iconografía vectorial    |

## 📊 Funcionalidades Detalladas

### Dashboard Principal

- **Tarjetas de Resumen**: Muestra ingresos totales, gastos totales y balance neto
- **Historial de Movimientos**: Lista de últimas transacciones con filtros
- **Formulario de Registro**: Interfaz para ingresar nuevas transacciones

### Distribución de Egresos

- **Gráfico de Donut**: Visualización proporcional de gastos por categoría
- **Desglose por Grupos**:
  - Hogar y Servicios Básicos
  - Taller de Costura
  - Familia y Niños

### Exportación de Datos

- Descargar transacciones en formato CSV
- Exportar reporte JSON
- Backup automático local

### Modo Oscuro

- Toggle con preferencia de sistema
- Persistencia en localStorage
- Variables CSS reactivas

## 🔧 Variables de Entorno

```env
# Supabase (opcional)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-aqui

# Aplicación
VITE_APP_NAME=MisFinanzas
VITE_APP_VERSION=1.0.0
```

## 💾 Almacenamiento de Datos

### Modo Local (Por Defecto)

- Datos guardados en **LocalStorage** del navegador
- Funciona completamente offline
- Capacidad limitada (~5-10MB)

### Modo Cloud (Con Supabase)

- Sincronización automática en Supabase
- Acceso desde múltiples dispositivos
- Respaldo seguro en la nube

## 🚀 Roadmap

### v1.0 (Actual)

- [x] CRUD de transacciones
- [x] Dashboard
- [x] Gráficos
- [x] Exportación CSV
- [x] Modo oscuro
- [x] Responsive

### v1.5 (Próximo)

- [ ] Categorías personalizadas
- [ ] Presupuestos mensuales
- [ ] Notificaciones
- [ ] Múltiples usuarios

### v2.0 (Futuro)

- [ ] PWA (Aplicación web instalable)
- [ ] Sincronización offline mejorada
- [ ] Análisis financiero avanzado

### v3.0 (Largo plazo)

- [ ] Integración IA para predicciones
- [ ] Recomendaciones inteligentes
- [ ] Análisis de tendencias

## 🔐 Seguridad

- **LocalStorage**: Datos solo en tu navegador
- **Supabase**: Encriptación y autenticación
- **No se almacenan contraseñas**
- **HTTPS recomendado en producción**

## 🤝 Contribuciones

Para contribuir al proyecto:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT - ver archivo LICENSE para más detalles.

## 🆘 Soporte

Para reportar bugs o sugerir mejoras, abre un issue en el repositorio.

---

**Hecho con ❤️ para simplificar tu gestión financiera**
