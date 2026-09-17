@echo off
setlocal
cd /d "%~dp0"
echo Libreria Quisqueya: http://127.0.0.1:8000
echo Manten esta ventana abierta mientras utilizas el sitio.
python -m http.server 8000 --bind 127.0.0.1
if errorlevel 1 (
    echo No se pudo iniciar Python. Instala Python 3 y vuelve a intentarlo.
    pause
)
