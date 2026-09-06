import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import uuid
from pathlib import Path
from unittest.mock import patch

from servidor import Pedidos, crear_servidor, validar_productos, enviar_correo, DESTINATARIO


class FacturasTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.envios = []
        def enviar(pedido, pdf):
            self.assertTrue(pdf.read_bytes().startswith(b"%PDF-"))
            self.envios.append(pedido["id"])
            return "enviado", "Aceptado por transporte de prueba."
        self.repo = Pedidos(self.tmp.name, enviar)
        self.datos = {"id": str(uuid.uuid4()), "productos": [{"id": 1, "cantidad": 2}, {"id": 2, "cantidad": 1}]}

    def test_total_precio_servidor_y_pdf(self):
        self.datos["productos"][0]["precio"] = 1
        pedido = self.repo.crear(self.datos)
        self.assertEqual(pedido["total"], 3050)
        self.assertEqual(pedido["cantidad"], 3)
        self.assertEqual(pedido["correo"], DESTINATARIO)
        self.assertEqual(pedido["estado"], "enviado")

    def test_duplicados_y_persistencia(self):
        self.repo.crear(self.datos)
        self.repo.crear(self.datos)
        reiniciado = Pedidos(self.tmp.name, self.repo.enviar)
        reiniciado.crear(self.datos)
        reiniciado.reintentar(self.datos["id"])
        self.assertEqual(len(self.envios), 1)
        self.datos["productos"][0]["cantidad"] = 3
        with self.assertRaises(ValueError): self.repo.crear(self.datos)

    def test_validaciones(self):
        for productos in ([], [{"id": 8, "cantidad": 1}], [{"id": 1, "cantidad": -1}],
                          [{"id": 1, "cantidad": 1.5}], [{"id": 1, "cantidad": True}],
                          [{"id": 1, "cantidad": 1000}], [{"id": 1, "cantidad": 1}] * 2):
            with self.assertRaises(ValueError): validar_productos(productos)

    def test_error_smtp_conserva_factura_y_reintento(self):
        def fallo(*args): raise TimeoutError()
        self.repo.enviar = fallo
        pedido = self.repo.crear(self.datos)
        self.assertEqual(pedido["estado"], "incierto")
        self.assertTrue(self.repo.ruta(pedido["id"], "pdf").exists())
        self.repo.enviar = lambda *args: ("enviado", "Aceptado")
        self.assertEqual(self.repo.crear(self.datos)["estado"], "incierto")
        self.assertEqual(self.repo.reintentar(pedido["id"])["estado"], "enviado")

    def test_correo_adjunto_y_sin_credenciales(self):
        pedido = self.repo.crear(self.datos)
        pdf = self.repo.ruta(pedido["id"], "pdf")
        with patch.dict("os.environ", {"SMTP_USER": "", "SMTP_APP_PASSWORD": ""}):
            self.assertEqual(enviar_correo(pedido, pdf)[0], "pendiente")
        with patch.dict("os.environ", {"SMTP_USER": DESTINATARIO, "SMTP_APP_PASSWORD": "clave-de-prueba"}), patch("servidor.smtplib.SMTP_SSL") as smtp:
            self.assertEqual(enviar_correo(pedido, pdf)[0], "enviado")
            mensaje = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
            self.assertEqual(mensaje["To"], DESTINATARIO)
            adjunto = list(mensaje.iter_attachments())[0]
            self.assertEqual(adjunto.get_content_type(), "application/pdf")
            self.assertEqual(adjunto.get_payload(decode=True), pdf.read_bytes())
            self.assertIn("3,050.00", mensaje.get_body().get_content())

    def test_http_y_archivos_privados(self):
        servidor = crear_servidor(0, self.repo)
        hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
        hilo.start()
        self.addCleanup(servidor.server_close)
        self.addCleanup(servidor.shutdown)
        base = f"http://127.0.0.1:{servidor.server_port}"
        with urllib.request.urlopen(base + "/api/config") as respuesta:
            token = json.load(respuesta)["token"]
        for ruta in ("/.env", "/servidor.py", "/datos/pedidos/test.json", "/assets/../servidor.py"):
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(base + ruta)
            self.assertEqual(error.exception.code, 404)
        req = urllib.request.Request(base + "/api/pedidos", json.dumps(self.datos).encode(), {"Content-Type": "application/json"})
        with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(req)
        self.assertEqual(error.exception.code, 403)
        req.add_header("Origin", base)
        req.add_header("X-Libreria-Token", token)
        with urllib.request.urlopen(req) as respuesta: pedido = json.load(respuesta)
        with urllib.request.urlopen(base + "/api/facturas/" + pedido["id"]) as respuesta:
            self.assertEqual(respuesta.headers["Content-Type"], "application/pdf")
            self.assertTrue(respuesta.read().startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
