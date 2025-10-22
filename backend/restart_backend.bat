@echo off
cd /d "%~dp0"
call venv\Scripts\activate.bat
echo ========================================
echo   BACKEND CALISIYOR - PORT 8000
echo ========================================
echo.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
