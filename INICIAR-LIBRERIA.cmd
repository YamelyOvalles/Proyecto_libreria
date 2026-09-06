@echo off
setlocal
cd /d "%~dp0"
set "LIBRERIA_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%LIBRERIA_PYTHON%" goto iniciar
set "LIBRERIA_PYTHON=python"
:iniciar
"%LIBRERIA_PYTHON%" -c "import reportlab" >nul 2>&1
if errorlevel 1 (
    echo Se necesita Python 3.10 o superior con ReportLab.
    echo Instala Python y ejecuta: python -m pip install -r requirements.txt
    pause
    exit /b 1
)
echo Abre http://127.0.0.1:8000 en tu navegador y entra al catalogo.
echo Mantén esta ventana abierta mientras utilizas la libreria.
"%LIBRERIA_PYTHON%" servidor.py
pause
