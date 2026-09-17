# Integración actual de pedidos

La aplicación utiliza Supabase para autenticación, catálogo, carrito, pedidos,
inventario y mensajes. Sigue primero `CONECTAR-SUPABASE.md`.

El archivo `servidor.py` y `test_facturas.py` se conservan como una versión
experimental anterior del generador de PDF. El frontend actual no envía pedidos
a ese servidor y tampoco presenta una confirmación ficticia cuando Supabase no
está disponible.

La generación fiscal de facturas y el envío de PDF deberán implementarse desde
un backend o una Supabase Edge Function en una fase posterior. Una clave
`service_role` o secret nunca debe colocarse en JavaScript del navegador.

Para iniciar el frontend, ejecuta `INICIAR-LIBRERIA.cmd` y abre
http://127.0.0.1:8000.
