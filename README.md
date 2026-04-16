# PetroField PWA

Esqueleto inicial de una plataforma operacional petrolera con arquitectura offline-first usando Node.js, Express, EJS y MySQL.

## Inicio rapido

1. Copia `env/.env.example` a `env/.env`.
2. Instala dependencias:
   - `npm install`
3. Inicia en desarrollo:
   - `npm run dev`

## Estructura

- `app.js`: arranque del servidor
- `routes/`: rutas web y API
- `controllers/`: logica de vistas y API
- `middleware/`: autenticacion, autorizacion y manejo de errores
- `database/`: conexion MySQL
- `public/`: recursos estaticos y PWA (service worker, manifest)
- `views/`: plantillas EJS
- `services/`: servicios de sincronizacion

## Nota

Este scaffold ya incluye:
- roles por departamento
- usuario `admin` con rol secreto para desarrollo
- base de estrategia offline-first (cache + cola de sincronizacion)
