"""Servidor local de pedidos, facturas PDF y confirmaciones por Gmail."""
import hashlib
import json
import os
import secrets
import smtplib
import ssl
import threading
import uuid
from datetime import datetime
from datetime import timezone, timedelta
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent
DESTINATARIO = "adamsdleons3@gmail.com"
CATALOGO = {
    1: ("Cien años de soledad", 1150),
    2: ("El Principito", 750),
    3: ("1984", 900),
    4: ("Don Quijote de la Mancha", 1350),
}


def cargar_configuracion():
    archivo = ROOT / ".env"
    if archivo.exists():
        for linea in archivo.read_text(encoding="utf-8-sig").splitlines():
            if linea.strip() and not linea.lstrip().startswith("#") and "=" in linea:
                clave, valor = linea.split("=", 1)
                os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))


def dinero(valor):
    return f"RD$ {valor:,.2f}"


def validar_productos(productos):
    if not isinstance(productos, list) or not 1 <= len(productos) <= 4:
        raise ValueError("Selecciona entre uno y cuatro títulos del catálogo.")
    vistos, resultado = set(), []
    for producto in productos:
        if not isinstance(producto, dict):
            raise ValueError("Producto inválido.")
        identificador, cantidad = producto.get("id"), producto.get("cantidad")
        if type(identificador) is not int or identificador not in CATALOGO or identificador in vistos:
            raise ValueError("El catálogo contiene un título inválido o repetido.")
        if type(cantidad) is not int or not 1 <= cantidad <= 999:
            raise ValueError("La cantidad debe ser un número entero entre 1 y 999.")
        vistos.add(identificador)
        titulo, precio = CATALOGO[identificador]
        resultado.append(dict(id=identificador, titulo=titulo, precio=precio,
                              cantidad=cantidad, subtotal=precio * cantidad))
    return sorted(resultado, key=lambda item: item["id"])


def crear_pdf(pedido, destino):
    verde = colors.HexColor("#4d662d")
    normal = ParagraphStyle("Normal", fontName="Helvetica", fontSize=10, leading=15)
    titulo = ParagraphStyle("Titulo", parent=normal, fontName="Helvetica-Bold", fontSize=24, leading=29, textColor=verde)
    derecha = ParagraphStyle("Derecha", parent=normal, alignment=TA_RIGHT)
    doc = SimpleDocTemplate(str(destino), pagesize=(595.28, 841.89),
                            rightMargin=42, leftMargin=42, topMargin=115, bottomMargin=65,
                            title=f"Factura {pedido['numero']}", author="Librería Quisqueya")
    contenido = [Paragraph("Factura de compra", titulo), Spacer(1, 14),
                 Paragraph(f"<b>Pedido:</b> {pedido['numero']}", normal),
                 Paragraph(f"<b>Fecha:</b> {pedido['fecha']}", normal),
                 Paragraph(f"<b>Correo:</b> {DESTINATARIO}", normal), Spacer(1, 24)]
    filas = [["Libro", "Cant.", "Precio unitario", "Subtotal"]]
    for item in pedido["productos"]:
        filas.append([Paragraph(item["titulo"], normal), str(item["cantidad"]),
                      dinero(item["precio"]), dinero(item["subtotal"])])
    tabla = Table(filas, colWidths=[218, 40, 117, 136.28], repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), verde), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0f3ec"), colors.white]),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#ccd4c4")),
    ]))
    contenido += [tabla, Spacer(1, 20),
                  Paragraph(f"<b>Total de unidades: {pedido['cantidad']}</b>", derecha),
                  Paragraph(f"<b>Total: {dinero(pedido['total'])}</b>", derecha),
                  Spacer(1, 28), Paragraph("Gracias por elegir Librería Quisqueya.", normal),
                  Paragraph("Confirmación del pedido de demostración. No acredita un pago ni sustituye un comprobante fiscal.",
                            ParagraphStyle("Nota", parent=normal, fontSize=8, textColor=colors.HexColor("#646a6e")))]

    def marco(canvas, documento):
        canvas.saveState()
        logo = ROOT / "assets" / "logo-quisqueya-icono.png"
        if logo.exists():
            canvas.setFillColor(verde)
            canvas.roundRect(40, 752, 58, 49, 6, fill=1, stroke=0)
            canvas.drawImage(ImageReader(str(logo)), 42, 755, width=54, height=45, preserveAspectRatio=True, mask="auto")
        canvas.setFillColor(verde)
        canvas.setFont("Helvetica-Bold", 17)
        canvas.drawString(108, 771, "Librería Quisqueya")
        canvas.setStrokeColor(verde)
        canvas.line(42, 741, 553, 741)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(42, 35, "Librería Quisqueya | Confirmación de pedido")
        canvas.drawRightString(553, 35, f"Página {documento.page}")
        canvas.restoreState()
    doc.build(contenido, onFirstPage=marco, onLaterPages=marco)


def enviar_correo(pedido, pdf):
    usuario = os.environ.get("SMTP_USER", "").strip()
    clave = os.environ.get("SMTP_APP_PASSWORD", "").replace(" ", "")
    if not usuario or not clave:
        return "pendiente", "Factura creada. Falta configurar la cuenta de envío. Puedes descargar el PDF."
    mensaje = EmailMessage()
    mensaje["From"] = f"Librería Quisqueya <{usuario}>"
    mensaje["To"] = DESTINATARIO
    mensaje["Subject"] = f"Factura {pedido['numero']} - Librería Quisqueya"
    mensaje["Message-ID"] = f"<{pedido['id']}@libreria.local>"
    detalle = "\n".join(f"- {p['titulo']}: {p['cantidad']} unidad(es), {dinero(p['subtotal'])}" for p in pedido["productos"])
    mensaje.set_content(f"Gracias por tu pedido en Librería Quisqueya.\n\nPedido: {pedido['numero']}\n{detalle}\n\nTotal: {dinero(pedido['total'])}\n\nAdjuntamos tu factura PDF.\nPedido de demostración: no se ha procesado un pago.")
    mensaje.add_attachment(pdf.read_bytes(), maintype="application", subtype="pdf", filename=f"{pedido['numero']}.pdf")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=25) as smtp:
        smtp.login(usuario, clave)
        smtp.send_message(mensaje)
    return "enviado", f"Pedido confirmado. Gmail aceptó la factura para enviarla a {DESTINATARIO}."


class Pedidos:
    def __init__(self, directorio, enviar=enviar_correo):
        self.directorio = Path(directorio)
        self.directorio.mkdir(parents=True, exist_ok=True)
        self.enviar = enviar
        self.lock = threading.Lock()

    def ruta(self, identificador, extension):
        if not isinstance(identificador, str) or str(uuid.UUID(identificador)) != identificador:
            raise ValueError("Identificador de pedido inválido.")
        return self.directorio / f"{identificador}.{extension}"

    def guardar(self, pedido):
        ruta = self.ruta(pedido["id"], "json")
        temporal = ruta.with_suffix(".tmp")
        temporal.write_text(json.dumps(pedido, ensure_ascii=False, indent=2), encoding="utf-8")
        temporal.replace(ruta)

    def mandar(self, pedido):
        # Se persiste antes del SMTP: una interrupción no causa reenvíos automáticos.
        pedido.update(estado="enviando", mensaje="Envío iniciado; aún no se ha confirmado.")
        self.guardar(pedido)
        try:
            estado, mensaje = self.enviar(pedido, self.ruta(pedido["id"], "pdf"))
        except smtplib.SMTPAuthenticationError:
            estado, mensaje = "pendiente", "Gmail rechazó el acceso. Revisa la contraseña de aplicación en la configuración local."
        except Exception:
            estado, mensaje = "incierto", "No se pudo confirmar el envío. Revisa tu bandeja antes de reintentar para evitar duplicados."
        pedido.update(estado=estado, mensaje=mensaje)
        self.guardar(pedido)
        return pedido

    def crear(self, datos):
        identificador = datos.get("id")
        ruta = self.ruta(identificador, "json")
        productos = validar_productos(datos.get("productos"))
        huella = hashlib.sha256(json.dumps(productos, sort_keys=True).encode()).hexdigest()
        with self.lock:
            if ruta.exists():
                pedido = json.loads(ruta.read_text(encoding="utf-8"))
                if pedido["huella"] != huella:
                    raise ValueError("Este identificador ya pertenece a otro pedido.")
                return pedido
            fecha = datetime.now(timezone(timedelta(hours=-4)))
            pedido = dict(id=identificador, numero=f"LQ-{fecha:%Y%m%d}-{identificador[:8].upper()}",
                          fecha=fecha.strftime("%d/%m/%Y %H:%M (UTC-4)"), correo=DESTINATARIO,
                          productos=productos, total=sum(p["subtotal"] for p in productos),
                          cantidad=sum(p["cantidad"] for p in productos), huella=huella,
                          estado="pendiente", mensaje="Factura generada.")
            crear_pdf(pedido, self.ruta(identificador, "pdf"))
            self.guardar(pedido)
            return self.mandar(pedido)

    def reintentar(self, identificador):
        with self.lock:
            pedido = json.loads(self.ruta(identificador, "json").read_text(encoding="utf-8"))
            if pedido["estado"] == "enviado":
                return pedido
            return self.mandar(pedido)


def crear_servidor(puerto=8000, pedidos=None):
    repositorio = pedidos or Pedidos(ROOT / "datos" / "pedidos")
    token = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def respuesta(self, codigo, datos, tipo="application/json; charset=utf-8"):
            contenido = json.dumps(datos, ensure_ascii=False).encode() if isinstance(datos, dict) else datos
            self.send_response(codigo)
            self.send_header("Content-Type", tipo)
            self.send_header("Content-Length", str(len(contenido)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(contenido)

        def local(self):
            return self.headers.get("Host") in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}")

        def do_GET(self):
            if not self.local():
                return self.respuesta(403, {"error": "Acceso local requerido."})
            ruta = unquote(urlparse(self.path).path)
            if ruta == "/api/config":
                return self.respuesta(200, {"token": token, "correo": DESTINATARIO})
            if ruta.startswith("/api/facturas/"):
                try:
                    archivo = repositorio.ruta(ruta.split("/")[-1], "pdf")
                    return self.respuesta(200, archivo.read_bytes(), "application/pdf")
                except (ValueError, FileNotFoundError, TypeError, AttributeError):
                    return self.respuesta(404, {"error": "Factura no encontrada."})
            relativa = ruta.lstrip("/") or "index.html"
            archivo = (ROOT / relativa).resolve()
            paginas = {"index.html", "login.html", "tienda.html", "informacion.html", "formulario.html"}
            permitido = relativa in paginas or relativa.startswith(("css/", "js/", "assets/"))
            if not permitido or not archivo.is_relative_to(ROOT) or not archivo.is_file():
                return self.respuesta(404, {"error": "Archivo no encontrado."})
            tipos = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg"}
            if archivo.suffix not in tipos:
                return self.respuesta(404, {"error": "Archivo no encontrado."})
            return self.respuesta(200, archivo.read_bytes(), tipos[archivo.suffix])

        def do_POST(self):
            origenes = (f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}")
            if not self.local() or self.headers.get("Origin") not in origenes or self.headers.get("X-Libreria-Token") != token:
                return self.respuesta(403, {"error": "Recarga la página para continuar desde el servidor local."})
            try:
                longitud = int(self.headers.get("Content-Length", "0"))
                if not 0 < longitud <= 4096:
                    raise ValueError("Solicitud demasiado grande o vacía.")
                datos = json.loads(self.rfile.read(longitud))
                if not isinstance(datos, dict):
                    raise ValueError("Pedido inválido.")
                if self.path == "/api/pedidos":
                    pedido = repositorio.crear(datos)
                elif self.path == "/api/reenviar":
                    pedido = repositorio.reintentar(datos.get("id"))
                else:
                    return self.respuesta(404, {"error": "Ruta no encontrada."})
                return self.respuesta(200, {k: v for k, v in pedido.items() if k != "huella"})
            except (ValueError, TypeError, AttributeError, FileNotFoundError):
                return self.respuesta(400, {"error": "Pedido inválido. Revisa los libros y las cantidades (1 a 999)."})
            except Exception:
                return self.respuesta(500, {"error": "No se pudo completar la operación. Tu carrito se conserva; puedes reintentar."})

    return ThreadingHTTPServer(("127.0.0.1", puerto), Handler)


if __name__ == "__main__":
    cargar_configuracion()
    servidor = crear_servidor()
    print("Librería lista: http://127.0.0.1:8000", flush=True)
    print("Cierra esta ventana o pulsa Ctrl+C para detenerla.", flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        servidor.server_close()
