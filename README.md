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
