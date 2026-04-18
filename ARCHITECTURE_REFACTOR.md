# Refactor incremental hacia arquitectura por módulos

## Estructura objetivo

```text
/modules
  /pozos
    pozo.controller.js
    pozo.service.js
    pozo.routes.js
  /muestras
  /parametros
  /niveles
  /servicios
  /auth
  /users

/services
  /auth
    password.service.js
  /sync
    sync.service.js

/public/js
  /core
    app.js
    ui.js
  /offline
    db.js
    sync.js
  /modules
    pozos.js
    muestras.js

/views
  /layouts
  /partials
  /modules
    /pozos
      index.ejs
      detalle.ejs
```

## Movimientos sugeridos

- Mover la lógica de pozos desde controladores genéricos hacia el módulo de dominio.
- Mantener [routes/web.js](routes/web.js) sólo para rutas transversales: login, logout, dashboard y navegación base.
- Reducir [routes/api.js](routes/api.js) a bootstrap global y sync, mientras cada dominio publica sus propios endpoints.
- Reemplazar [controllers/shared/crud.js](controllers/shared/crud.js) por servicios específicos por módulo.
- Migrar [services/passwordService.js](services/passwordService.js) y [services/syncService.js](services/syncService.js) a carpetas por responsabilidad, dejando wrappers de compatibilidad durante la transición.
- Reubicar las vistas de dominio bajo [views/modules/pozos](views/modules/pozos).

## Renombres y limpieza

- Usar el nombre correcto de Service Worker register: ya existe como [public/js/sw-register.js](public/js/sw-register.js).
- Adoptar raíz para variables de entorno, manteniendo compatibilidad temporal con la carpeta legacy [env](env).
- Unificar imágenes e iconos dentro de [public/assets](public/assets).

## Estrategia de migración sin romper producción

1. Crear el nuevo módulo y montarlo en paralelo a las rutas actuales.
2. Mantener wrappers en servicios y scripts antiguos.
3. Validar cada dominio por separado con el mismo layout EJS.
4. Mover la lógica desde el archivo compartido hacia servicios dedicados.
5. Cuando todo el tráfico del dominio esté migrado, retirar el código legacy.

## Slice implementado en esta iteración

- Nuevo módulo de pozos en [modules/pozos/pozo.routes.js](modules/pozos/pozo.routes.js), [modules/pozos/pozo.controller.js](modules/pozos/pozo.controller.js) y [modules/pozos/pozo.service.js](modules/pozos/pozo.service.js).
- Nuevas vistas de pozo en [views/modules/pozos/index.ejs](views/modules/pozos/index.ejs) y [views/modules/pozos/detalle.ejs](views/modules/pozos/detalle.ejs).
- Reorganización inicial del frontend PWA con [public/js/core/app.js](public/js/core/app.js), [public/js/offline/db.js](public/js/offline/db.js), [public/js/offline/sync.js](public/js/offline/sync.js) y [public/js/modules/pozos.js](public/js/modules/pozos.js).

## Próximos módulos recomendados

1. Muestras
2. Parámetros diarios
3. Tomas de nivel
4. Servicios de campo
5. Usuarios y autenticación
