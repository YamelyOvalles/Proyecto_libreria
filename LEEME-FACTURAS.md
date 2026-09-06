# Facturas PDF y confirmación por correo

Estos cambios pertenecen únicamente a Proyecto_libreria_Fase2_Mejoras.

## Abrir la librería

1. Haz doble clic en `INICIAR-LIBRERIA.cmd` y deja esa ventana abierta.
2. Abre http://127.0.0.1:8000 en tu navegador, inicia sesión y entra al catálogo.
3. Agrega los libros y pulsa **Confirmar pedido y enviar factura**.
4. La página muestra el resultado del envío y permite descargar el PDF. Las facturas se conservan en `datos/pedidos/` junto al registro del pedido.

Abrir `index.html` directamente o mediante Live Server permite ver la página, pero para las facturas debes usar el servidor anterior.

## Activar el envío real por Gmail

El destinatario está fijado en **adamsdleons3@gmail.com**. De forma inicial se propone la misma cuenta como remitente; puedes cambiar `SMTP_USER` a otra cuenta Gmail tuya.

1. Activa la verificación en dos pasos en la cuenta remitente y crea una contraseña de aplicación de Google. Consulta https://support.google.com/mail/answer/185833?hl=es . La disponibilidad depende de la configuración de la cuenta.
2. Abre el archivo `.env` local con Bloc de notas. Completa `SMTP_USER` y `SMTP_APP_PASSWORD` con esa contraseña de aplicación. No uses la contraseña habitual ni compartas este archivo.
3. Guarda el archivo y reinicia `INICIAR-LIBRERIA.cmd` para cargar la configuración.
4. Confirma un pedido. Si ya tienes una factura pendiente, pulsa **Reintentar envío**. Revisa también Spam.

Sin credencial, el PDF se genera y el correo queda pendiente. El programa nunca muestra que se envió si Gmail no lo aceptó. La aceptación SMTP no garantiza la llegada a la bandeja de entrada.

## Qué contiene la factura

- Número de pedido y fecha en horario de Santo Domingo (UTC-4).
- Correo destinatario.
- Títulos, cantidades, precios unitarios y subtotales.
- Cantidad de unidades y monto total en RD$.

La compra continúa siendo una demostración: no se cobra dinero. El PDF lo indica y no incorpora datos fiscales ficticios.

## Funcionamiento y pruebas

El frontend continúa en JavaScript. `servidor.py` utiliza Python 3.10+ y ReportLab para los PDF; el envío usa SMTP de Gmail con TLS. `requirements.txt` contiene la dependencia. En esta computadora el iniciador utiliza el Python disponible en el runtime local; en otra, instala Python y ejecuta `python -m pip install -r requirements.txt`.

Ejecuta `python -m unittest -v test_facturas.py` para comprobar importes, validaciones, persistencia, pedidos repetidos, adjuntos y errores de correo. Las pruebas simulan el transporte: no envían correos reales.

El servidor escucha solo en 127.0.0.1. Recalcula los importes con su propio catálogo, restringe las rutas públicas y exige un token del mismo origen para crear pedidos. `.env`, los registros, las pruebas y el código del servidor no se sirven al navegador. No publiques este servidor de demostración como una tienda de producción.

Un identificador persistente evita que reintentar una solicitud o pulsar dos veces genere otra factura. Los envíos interrumpidos no se repiten automáticamente; primero revisa el correo y después decide si deseas reintentar. No edites ni borres los registros de `datos/pedidos` mientras haya pedidos pendientes.
