# 🛢️ PWA Optimización - Arquitectura Objetivo

Este documento define la **estructura final recomendada del proyecto**, basada en una arquitectura modular (feature-based), diseñada para escalar un sistema complejo orientado a operaciones petroleras.

---

# 🎯 Principios de Arquitectura

- Arquitectura basada en **módulos (dominio/feature)**
- Separación clara entre:
  - Backend (lógica, rutas, DB)
  - Frontend (PWA, offline-first)
  - Vistas (EJS modular)

- El sistema gira alrededor de la entidad central:
  👉 **POZOS**

---

# 🧱 Estructura Final Objetivo

```text
pwa_optimizacion/
  .env.example
  .git/
    config
    description
    HEAD
    hooks/
      applypatch-msg.sample
      commit-msg.sample
      fsmonitor-watchman.sample
      post-update.sample
      pre-applypatch.sample
      pre-commit.sample
      pre-merge-commit.sample
      pre-push.sample
      pre-rebase.sample
      pre-receive.sample
      prepare-commit-msg.sample
      push-to-checkout.sample
      sendemail-validate.sample
      update.sample
    index
    info/
      exclude
    logs/
      HEAD
      refs/
        heads/
          main
        remotes/
          origin/
            HEAD
    objects/
      info/
      pack/
        pack-abea1ada283ce1dc6658836020d5608056f7b356.idx
        pack-abea1ada283ce1dc6658836020d5608056f7b356.pack
        pack-abea1ada283ce1dc6658836020d5608056f7b356.rev
    packed-refs
    refs/
      heads/
        main
      remotes/
        origin/
          HEAD
      tags/
  .gitignore
  app.js
  ARCHITECTURE_REFACTOR.md
  config/
    db.js
    env.js
  database/
    dumps/
      pwa_opti_legacy.sql
    migrations/
    model/
      database.mwb
      database.mwb.bak
    schema/
      schema.sql
    seeds/
    views/
      README.md
  middleware/
    auth.js
    error.js
  modules/
    auth/
      auth.controller.js
      auth.routes.js
      auth.service.js
    dashboard/
      dashboard.controller.js
      dashboard.routes.js
      dashboard.service.js
    index.js
    muestras/
      muestra.controller.js
      muestra.routes.js
      muestra.service.js
    niveles/
      nivel.controller.js
      nivel.routes.js
      nivel.service.js
    offline/
      offline.controller.js
      offline.routes.js
      offline.service.js
    parametros/
      parametro.controller.js
      parametro.routes.js
      parametro.service.js
    pozos/
      pozo.controller.js
      pozo.routes.js
      pozo.service.js
    servicios/
      servicio.controller.js
      servicio.routes.js
      servicio.service.js
    users/
      user.controller.js
      user.routes.js
      user.service.js
  package-lock.json
  package.json
  postcss.config.js
  public/
    assets/
      icons/
        icon-192.svg
        icon-512.svg
        icono.png
      images/
        header.png
    css/
      app.css
      tailwind.css
      tailwind.input.css
    js/
      app-ui.js
      core/
        app.js
        ui.js
      modules/
        muestras.js
        niveles.js
        parametros.js
        pozos.js
      offline/
        db.js
        store.js
        sync.js
      sw-register.js
    manifest.json
    sw.js
  README.md
  services/
    auth/
      password.service.js
    sync/
      sync.service.js
  tailwind.config.js
  views/
    auth/
      login.ejs
    errors/
      404.ejs
      500.ejs
      noAutorizado.ejs
    index.ejs
    layouts/
      auth-layout.ejs
      mainLayout.ejs
    modules/
      muestras/
        index.ejs
      niveles/
        index.ejs
      parametros/
        index.ejs
      pozos/
        detalle.ejs
        index.ejs
        partials/
          equipos.ejs
          general.ejs
          muestras.ejs
          niveles.ejs
          parametros.ejs
      servicios/
        index.ejs
      users/
        crear.ejs
    partials/
      card.ejs
      sidebar.ejs
      table.ejs
      tabs.ejs
      topbar.ejs
```

---

# ❌ Estructura que DEBE eliminarse

Eliminar completamente:

```text
/controllers/
routes/
controllers/shared/crud.js
env/                ❌ mover .env al root (mantener solo compatibilidad temporal)
```

---

# 🔄 Cambios obligatorios

## 1. Rutas

ANTES:

```js
/routes/web.js
```

DESPUÉS:

```js
app.use("/pozos", require("./modules/pozos/pozo.routes"));
```

---

## 2. Controllers

ANTES:

```text
/controllers/users/userController.js
```

DESPUÉS:

```text
/modules/users/user.controller.js
```

---

## 3. Lógica CRUD

❌ NO usar:

```text
/controllers/shared/crud.js
```

✔️ Cada módulo maneja su propia lógica:

```text
/modules/pozos/pozo.service.js
```

---

## 4. Servicios

Separar por responsabilidad:

```text
/services/auth/password.service.js
/services/sync/sync.service.js
```

---

## 5. Frontend JS

Eliminar:

```text
/public/js/app-ui.js
/public/js/offline-store.js
```

Mover a:

```text
/public/js/core/
/public/js/offline/
/public/js/modules/
```

---

## 6. Assets

Unificar:

```text
/public/assets/images/
/public/assets/icons/
```

Eliminar:

```text
/public/icons/
```

---

# 🧠 Convenciones importantes

## 📌 1. Cada módulo debe contener:

- controller
- service
- routes

---

## 📌 2. Las vistas SIEMPRE siguen esta estructura:

```text
/views/modules/{modulo}/
```

---

## 📌 3. UI reutilizable SIEMPRE en:

```text
/views/partials/
```

---

## 📌 4. JS frontend modular:

```text
/public/js/modules/{modulo}.js
```

---

# 🚀 Flujo de trabajo recomendado

1. Refactor backend por módulos (pozos primero)
2. Migrar rutas
3. Migrar vistas
4. Refactor frontend JS
5. Implementar offline sync correctamente

---

# ⚠️ Nota importante

Este sistema **NO es una app CRUD simple**.
Es un sistema operativo de campo, por lo que:

- La entidad central es: **POZO**
- Todos los módulos deben relacionarse con ella
- La UI debe seguir patrón:
  👉 lista → detalle → análisis → planificación

---

## Base consolidada OFM

La conexión usa `DB_NAME` del entorno. Debe ser el nombre real de la base consolidada que contiene las vistas y los datos OFM: `pwa_ofm` en `.env.example` es un ejemplo; el entorno local inspeccionado utiliza `pwa_target`. En Render, verifica el valor actual de `DB_NAME` y la presencia de las vistas antes de cambiarlo. Conserva `DB_HOST`, `DB_PORT`, `DB_USER` y `DB_PASSWORD` de la instancia que aloja esa base. Para usar TLS con verificación de certificado, configura `DB_SSL_CA` con la ruta del certificado CA o `DB_SSL_CA_TEXT` con su PEM; `config/db.js` pasa esa CA a MySQL. [Aiven recomienda SSL para MySQL](https://aiven.io/docs/products/mysql/howto/connect-from-mysql-workbench), aunque el servicio puede aceptar conexiones sin TLS si no se exige para el usuario. No guardes credenciales ni certificados privados en Git. Si MySQL responde `ER_BAD_DB_ERROR`, confirma que el host y usuario configurados tienen acceso a la base indicada por `DB_NAME` antes de cambiar otros valores. Este repositorio no despliega el esquema ni carga los datos OFM automáticamente al hacer push.

La ficha consulta `vw_bomba_actual_consolidada`, `vw_pozo_muestras_con_fuente`, `vw_pozo_survey_activo` y `vw_pozo_produccion_historial` por `id_pozo`. Los endpoints `GET /pozos/:id/survey` y `GET /pozos/:id/produccion` requieren sesión y devuelven `{ ok: true, data: [...] }`; un pozo existente sin registros devuelve una lista vacía. La descarga inicial guarda en IndexedDB los pozos y sus datos globales, incluidos surveys, producción histórica y pruebas OFM, para abrir incluso fichas no visitadas sin conexión. Después de esa primera descarga, los datos se actualizan solo desde el botón manual de la barra superior.

Las pruebas históricas se leen de `pruebas_pozo` por `id_pozo` y se conservan en la base offline global. En Muestras, la gráfica adicional de % AyS incluye solamente las pruebas cuya fuente es `OFM`; las pruebas OFM y las de otras fuentes tienen tablas independientes con búsqueda, orden y paginación. En Producción, petróleo es verde, agua azul y gas rojo. Cada gráfica permite fijar mínimos y máximos verticales; la gráfica de cruce representa cada variable como porcentaje de su máximo visible y muestra el valor real y la fuente en el tooltip. Las gráficas pueden exportarse como PNG desde móvil o escritorio. La ficha también genera un reporte local imprimible como PDF con las últimas dos bombas, producción, survey, muestras y, para pozos activos, parámetros recientes. El dashboard indica cuántos pozos tienen producción y pruebas OFM.

La pestaña **Análisis por bomba** cruza las fechas de instalación y falla del historial de bombas con la producción mensual por completación, tanto online como offline. Cuando no hay fecha de falla, cierra el período antes de la siguiente instalación; si tampoco existe, lo deja abierto hasta hoy. Solo atribuye meses completos, sin prorratear los meses de cambio de bomba. Presenta la tendencia, el promedio mensual por bomba, los meses excluidos y un resumen exportable como PNG o CSV.

### Índice recomendado

En la instancia inspeccionada, `pozo_survey` solo tenía su clave primaria. Para acelerar la vista de survey filtrada por pozo y ordenada por fila y MD, el administrador puede evaluar este índice, sin que la aplicación lo cree automáticamente:

```sql
CREATE INDEX idx_pozo_survey_pozo_activo_orden_md
ON pozo_survey (id_pozo, activo, fila_orden, md);
```

`produccion_mensual` ya tiene `idx_prod_pozo_fecha (id_pozo, fecha)` y `idx_prod_completacion (id_pozo, completacion, fecha)`; no se recomienda otro índice de producción en este momento.
