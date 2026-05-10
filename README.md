# TestFX Backend

Backend de la app TestFX para autenticación, administración de usuarios, verificación por SMS y gestión de máquinas virtuales (VMs) con eventos en tiempo real.

## ¿Para qué sirve?

Este backend permite:

- Registrar e iniciar sesión de usuarios con roles (`Administrador` y `Cliente`).
- Proteger rutas con JWT en cookie HTTP-only.
- Enviar y validar códigos SMS para login alternativo.
- Gestionar VMs (listar, crear, editar, eliminar) con control de permisos por rol.
- Notificar cambios de VMs en tiempo real por Socket.IO.

## Tecnologías

Stack principal del backend:

- Runtime y lenguaje: `Node.js` + `TypeScript`
- Framework: `NestJS`
- Base de datos: `LibSQL / Turso` con `@libsql/client`
- Autenticación: `JWT` con `@nestjs/jwt`, `passport`, `passport-jwt`
- Seguridad de contraseñas: `bcrypt`
- Validación de datos: `zod`
- Cookies: `cookie-parser`
- Logs HTTP: `morgan`
- SMS: `twilio`
- Tiempo real: `WebSockets` con `@nestjs/websockets` + `socket.io`

Dependencias clave usadas en la app:

| Tecnología | Librerías | Uso en el proyecto |
|---|---|---|
| API REST | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | Exponer endpoints de auth, usuarios, VMs y health. |
| Configuración | `@nestjs/config`, `dotenv` | Cargar y gestionar variables de entorno. |
| Autenticación | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | Protección de rutas con token y roles. |
| Persistencia | `@libsql/client` | Conexión y queries sobre LibSQL/Turso. |
| Validación | `zod` | Validación de payloads de entrada. |
| Seguridad | `bcrypt` | Hash y validación de contraseñas. |
| Realtime | `@nestjs/websockets`, `socket.io` | Eventos en tiempo real para cambios de VMs. |
| Integraciones | `twilio` | Envío y verificación de códigos SMS. |

## Puertos y red

- API HTTP: `PORT` (por defecto `4000`).
- Socket.IO: comparte el mismo puerto HTTP de Nest (ejemplo: `http://localhost:4000`).
- CORS permitido por `CORS_ORIGINS` (lista separada por comas).

## Variables de entorno

Variables principales usadas por el backend:

- `PORT`
- `NODE_ENV`
- `CORS_ORIGINS`
- `DB_URL`
- `DB_TOKEN`
- `SECRET_KEY`
- `SALT_ROUND_NUMBER`
- `VM_ADMIN_SIGNUP_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE`
- `TWILIO_DEFAULT_COUNTRY_CODE`

## Instalación y ejecución

```bash
npm install
npm run start:dev
```

Otros scripts:

```bash
npm run build
npm run start
npm run start:prod
npm run test
```

## API REST

Base URL local sugerida:

```text
http://localhost:4000
```

### Auth

| Método | Endpoint | ¿Para qué sirve? |
|---|---|---|
| POST | `/api/auth/register` | Registrar usuario nuevo. Si el rol es `Administrador`, exige `adminKey` válida (`VM_ADMIN_SIGNUP_KEY`). |
| POST | `/api/auth/login` | Iniciar sesión por correo y contraseña. |
| POST | `/api/auth/logout` | Cerrar sesión y limpiar cookie de acceso. |
| GET | `/api/auth/me` | Obtener usuario autenticado actual. Requiere JWT. |
| POST | `/api/auth/sms/send-code` | Enviar código SMS al teléfono registrado. |
| POST | `/api/auth/sms/verify-code` | Validar código SMS e iniciar sesión. |
| POST | `/api/auth/users` | Crear usuario desde panel admin. Requiere rol `Administrador`. |

### ¿Cómo crear un usuario Administrador?

Para registrar un usuario con rol Administrador debes usar el endpoint de registro y enviar la clave admin.

Requisitos:

- Tener definida la variable `VM_ADMIN_SIGNUP_KEY` en `.env`.
- Enviar el campo `role` como `Administrador` (también acepta `admin`).
- Enviar `adminKey` con el mismo valor exacto de `VM_ADMIN_SIGNUP_KEY`.

Ejemplo:

```json
{
  "nombre": "Nombre Admin",
  "email": "admin@empresa.com",
  "password": "Admin12345",
  "phone": "3136122636",
  "role": "Administrador",
  "adminKey": "AdminKey123"
}
```

Errores comunes:

- `403 Registro de admin deshabilitado`: `VM_ADMIN_SIGNUP_KEY` no está cargada en runtime.
- `403 Clave de admin inválida`: `adminKey` no coincide exactamente con la variable del entorno.
- `400 Teléfono inválido o obligatorio`: falta `phone` o no cumple formato válido.

### VMs

Se exponen rutas en dos prefijos equivalentes: `/api/vms` y `/vms`.

| Método | Endpoint | ¿Para qué sirve? |
|---|---|---|
| GET | `/api/vms` | Listar VMs. |
| GET | `/api/vms/summary` | Resumen agregado por estado (`Encendida`, `Apagada`, `Suspendida`). |
| GET | `/api/vms/:id` | Obtener detalle de una VM. |
| POST | `/api/vms` | Crear VM. Solo `Administrador`. |
| PUT | `/api/vms/:id` | Actualizar VM. Solo `Administrador`. |
| DELETE | `/api/vms/:id` | Eliminar VM. Solo `Administrador`. |

### Health y utilitarias

| Método | Endpoint | ¿Para qué sirve? |
|---|---|---|
| GET | `/health` | Healthcheck del servicio (`status`, `timestamp`, `uptime`). |
| GET | `/task` | Endpoint básico de prueba. |
| GET | `/` | Endpoint raíz básico de prueba. |

## Socket.IO (tiempo real)

Eventos emitidos por backend cuando cambian las VMs:

- `vm:created`
- `vm:updated`
- `vm:deleted`
- `vm:changed` (evento genérico con `{ event, payload }`)

Uso típico en frontend:

- Escuchar `vm:deleted` para remover el elemento borrado en UI.
- Escuchar `vm:changed` para refresco general si quieres una sola suscripción.

## Tablas de base de datos

El backend crea e inicializa automáticamente estas tablas:

### `vm_users`

Guarda usuarios de la plataforma.

- `id` (PK)
- `nombre`
- `email` (único)
- `phone` (único cuando no es null)
- `password_hash`
- `role` (`Administrador` o `Cliente`)
- `status` (`active` o `inactive`)
- `createdAt`
- `updatedAt`

### `virtual_machines`

Guarda inventario de VMs.

- `id` (PK)
- `name` (único)
- `cores`
- `ram`
- `disk`
- `os`
- `status` (`Encendida`, `Apagada`, `Suspendida`)
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`
- `statusUpdatedAt`

### `vm_sms_verification_codes`

Guarda códigos temporales de verificación SMS.

- `id` (PK)
- `phone`
- `code`
- `attempts`
- `used`
- `createdAt`
- `expiresAt`

## Datos semilla (seed)

Al iniciar, se insertan si no existen:

- Usuarios demo:
  - `admin@testfx.local` (Administrador)
  - `cliente@testfx.local` (Cliente)
- VMs demo:
  - `core-api-01`
  - `backoffice-01`
  - `batch-worker-01`

## Notas importantes

- El registro de administradores depende de `VM_ADMIN_SIGNUP_KEY`.
- Si cambias variables en `.env`, reinicia el servidor.
- `OPTIONS` con `204` en navegador es normal (preflight CORS).
