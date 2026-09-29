# Librería Quisqueya

Sistema web académico para consultar libros, realizar pedidos y administrar una librería. Supabase funciona como base de datos, autenticación, almacenamiento y backend seguro.

## Funcionalidades

- Sitio público con información, catálogo y contacto.
- Registro, inicio de sesión, recuperación de contraseña y cierre de sesión.
- Catálogo, carrito, pedidos y cotizaciones para clientes.
- Panel responsive para pedidos, productos, inventario, usuarios, mensajes y facturas.
- CRUD de productos y categorías con imágenes almacenadas en Supabase Storage.
- Roles de cliente, empleado y administrador protegidos con RLS.

## Tecnologías

- Node.js, Express.js, HTML, CSS y JavaScript.
- Supabase Auth, PostgreSQL, Storage y Edge Functions.

## Instalación

1. Crea un proyecto nuevo en Supabase.
2. Ejecuta completo [database/database.sql](database/database.sql) en **SQL Editor**. El script crea la estructura final, políticas RLS, funciones y los libros iniciales.
3. Copia `js/supabase-config.example.js` como `js/supabase-config.js`.
4. Coloca en ese archivo la URL del proyecto y su clave pública `anon` o `publishable`.
5. Copia `server/.env.example` como `server/.env` y coloca la URL y la clave pública del mismo proyecto Supabase. Nunca coloques una clave `service_role` en ese archivo.
6. Instala e inicia el servidor Express desde la raíz:

```powershell
npm install
npm start
```

Abre `http://localhost:3000`. El estado del servidor se puede consultar en `/api/health`. El sitio también se puede servir con un servidor estático, pero la configuración local de Supabase se entrega desde Express.

## Primer administrador

Registra una cuenta desde la aplicación, copia su UUID desde **Authentication > Users** y ejecuta:

```sql
insert into public.usuario_roles (usuario_id, rol_id)
select 'UUID_DEL_USUARIO', id
from public.roles
where codigo = 'administrador'
on conflict (usuario_id) do update set rol_id = excluded.rol_id;
```

## Administración de usuarios desde el panel

La Edge Function mantiene la clave administrativa fuera del navegador y permite crear o
eliminar cuentas. Los usuarios con pedidos, cotizaciones o facturas se deben desactivar
en lugar de eliminar para conservar su historial. Con Supabase CLI instalado y el proyecto
enlazado, despliega:

```powershell
supabase functions deploy bright-action --no-verify-jwt
```

La función valida internamente el token y el rol del administrador. Supabase aporta automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; no deben copiarse al repositorio.

## Base de datos

`database/database.sql` es el esquema de instalación para un proyecto Supabase nuevo.
No lo ejecutes completo sobre una base existente sin revisar primero su contenido y hacer
un respaldo.

## Publicación en Vercel

El repositorio incluye `vercel.json`: Vercel sirve el frontend estático y ejecuta
`api/supabase-config.js` como función Node para entregar al navegador la configuración
pública. No hace falta compilar la aplicación. Importa el repositorio en Vercel con la
carpeta raíz del proyecto como **Root Directory** y el preset **Other** (sin comando de
build ni carpeta de salida).

En **Project Settings → Environment Variables**, define estas variables para los entornos
que vayas a desplegar (Production y Preview):

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública `anon` o `publishable` del mismo proyecto |

No uses `service_role` ni una clave `sb_secret_` en estas variables. Después de guardarlas,
crea un nuevo deployment para que Vercel las aplique. Comprueba que
`/js/supabase-config.js` devuelva una asignación de configuración válida sin compartir su
contenido, y que el login deje de mostrar el aviso de configuración. El uso de funciones
Node desde `api/` y la lectura de variables con `process.env` siguen el esquema de Vercel
para [funciones Node.js](https://vercel.com/docs/functions/runtimes/node-js) y
[variables de entorno](https://vercel.com/docs/environment-variables).

En Supabase, agrega el dominio de producción y los dominios Preview que utilizarás a las
URL permitidas de autenticación. Si se utiliza Google OAuth, actualiza también sus URLs de
redirección autorizadas.

## Estructura principal

```text
assets/                 Imágenes y portadas
css/                    Estilos de la interfaz
database/database.sql   Instalación completa de Supabase
js/                     Lógica del frontend
supabase/functions/     Función segura para crear usuarios
server/                 Servidor Node.js + Express.js
evidencias/             Capturas y reporte de ejecución del servidor
```
