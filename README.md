
# 🛢️ PWA Optimización - Arquitectura Objetivo

Este documento define la **estructura final recomendada del proyecto**, basada en una arquitectura modular (feature-based), diseñada para escalar un sistema complejo orientado a operaciones petroleras.

---

# 🎯 Principios de Arquitectura

* Arquitectura basada en **módulos (dominio/feature)**
* Separación clara entre:

  * Backend (lógica, rutas, DB)
  * Frontend (PWA, offline-first)
  * Vistas (EJS modular)
* El sistema gira alrededor de la entidad central:
  👉 **POZOS**

---

# 🧱 Estructura Final Objetivo

```text
pwa_optimizacion/
├── app.js
├── package.json
├── .env
├── .gitignore
├── README.md
│
├── modules/                  # 🔥 CORE DE LA APP (feature-based)
│   ├── pozos/
│   │   ├── pozo.controller.js
│   │   ├── pozo.service.js
│   │   ├── pozo.routes.js
│   │   └── pozo.validator.js (opcional)
│   │
│   ├── muestras/
│   ├── parametros/
│   ├── niveles/
│   ├── servicios/
│   ├── users/
│   └── auth/
│
├── database/
│   ├── db.js
│   └── schema.sql
│
├── middleware/
│   ├── auth.js
│   └── error.js
│
├── services/                # 🔧 Servicios transversales (NO lógica de dominio)
│   ├── auth/
│   │   └── password.service.js
│   ├── sync/
│   │   └── sync.service.js
│   └── db/ (opcional)
│
├── public/                  # 🎨 Frontend (PWA)
│   ├── manifest.json
│   ├── sw.js
│   │
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   │
│   ├── css/
│   │   ├── app.css          # CSS final compilado
│   │   └── tailwind.input.css
│   │
│   └── js/
│       ├── core/
│       │   ├── app.js
│       │   └── ui.js
│       │
│       ├── offline/
│       │   ├── db.js        # IndexedDB wrapper
│       │   └── sync.js
│       │
│       └── modules/
│           ├── pozos.js
│           ├── muestras.js
│           ├── parametros.js
│           └── niveles.js
│
├── views/
│   ├── layouts/
│   │   ├── mainLayout.ejs
│   │   └── auth-layout.ejs
│   │
│   ├── partials/           # 🔥 REUTILIZABLES UI
│   │   ├── sidebar.ejs
│   │   ├── topbar.ejs
│   │   ├── card.ejs
│   │   ├── table.ejs
│   │   └── tabs.ejs
│   │
│   ├── modules/
│   │   ├── pozos/
│   │   │   ├── index.ejs
│   │   │   ├── detalle.ejs
│   │   │   └── partials/
│   │   │       ├── general.ejs
│   │   │       ├── equipos.ejs
│   │   │       ├── parametros.ejs
│   │   │       ├── niveles.ejs
│   │   │       └── muestras.ejs
│   │   │
│   │   ├── muestras/
│   │   ├── parametros/
│   │   └── niveles/
│   │
│   ├── auth/
│   │   └── login.ejs
│   │
│   └── errors/
│       ├── 404.ejs
│       ├── 500.ejs
│       └── noAutorizado.ejs
```

---

# ❌ Estructura que DEBE eliminarse

Eliminar completamente:

```text
/controllers/
routes/
controllers/shared/crud.js
env/                ❌ mover .env al root
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
app.use('/pozos', require('./modules/pozos/pozo.routes'));
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

* controller
* service
* routes

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

* La entidad central es: **POZO**
* Todos los módulos deben relacionarse con ella
* La UI debe seguir patrón:
  👉 lista → detalle → análisis → planificación

---



