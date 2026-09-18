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

- HTML, CSS y JavaScript.
- Supabase Auth, PostgreSQL, Storage y Edge Functions.

## Instalación

1. Crea un proyecto nuevo en Supabase.
2. Ejecuta completo [database/database.sql](database/database.sql) en **SQL Editor**. El script crea la estructura final, políticas RLS, funciones y los libros iniciales.
3. Copia `js/supabase-config.example.js` como `js/supabase-config.js`.
4. Coloca en ese archivo la URL del proyecto y su clave pública `anon` o `publishable`.
5. Sirve el proyecto con un servidor local, por ejemplo:

```powershell
python -m http.server 8000
```

Abre `http://localhost:8000`. `js/supabase-config.js` está ignorado por Git y nunca debe contener una `service_role` o una clave secreta.

## Primer administrador

Registra una cuenta desde la aplicación, copia su UUID desde **Authentication > Users** y ejecuta:

```sql
insert into public.usuario_roles (usuario_id, rol_id)
select 'UUID_DEL_USUARIO', id
from public.roles
where codigo = 'administrador'
on conflict (usuario_id) do update set rol_id = excluded.rol_id;
```

## Creación de usuarios desde el panel

La Edge Function mantiene la clave administrativa fuera del navegador. Con Supabase CLI instalado y el proyecto enlazado, despliega:

```powershell
supabase functions deploy bright-action --no-verify-jwt
```

La función valida internamente el token y el rol del administrador. Supabase aporta automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; no deben copiarse al repositorio.

## Publicación

El frontend es estático y puede publicarse con GitHub Pages. Configura en Supabase las URL permitidas de autenticación para el dominio publicado y conserva las credenciales privadas únicamente del lado servidor.

## Estructura principal

```text
assets/                 Imágenes y portadas
css/                    Estilos de la interfaz
database/database.sql   Instalación completa de Supabase
js/                     Lógica del frontend
supabase/functions/     Función segura para crear usuarios
```
