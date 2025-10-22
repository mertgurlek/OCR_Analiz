@echo off
setlocal enabledelayedexpansion
title Fis Okuma OCR - Tum Sistem Baslat
color 0E

:: ===================================================
::  FIS OKUMA OCR A/B TEST PLATFORMU
::  3 Servis - 2 Sanal Ortam - Tek Dosya
:: ===================================================

cls
echo.
echo =========================================================
echo    FIS OKUMA OCR A/B TEST PLATFORMU
echo =========================================================
echo.
echo    1. PaddleOCR Mikroservis : Port 8001
echo    2. Backend (Ana API)     : Port 8000
echo    3. Frontend              : Port 5173
echo.
echo =========================================================
echo.

:: Ana dizini sakla
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: ===================================================
:: 1. PORT KONTROLU ve TEMIZLEME
:: ===================================================
echo [1/7] Port kontrolu yapiliyor...
echo.

:: Port 8001 kontrolu (PaddleOCR)
netstat -ano | findstr ":8001" >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] Port 8001 kullaniliyor. Temizleniyor...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

:: Port 8000 kontrolu (Backend)
netstat -ano | findstr ":8000" >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] Port 8000 kullaniliyor. Temizleniyor...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

:: Port 5173 kontrolu (Frontend)
netstat -ano | findstr ":5173" >nul 2>&1
if !errorlevel! equ 0 (
    echo [!] Port 5173 kullaniliyor. Temizleniyor...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

echo [OK] Tum portlar temizlendi.
echo.

:: ===================================================
:: 2. PADDLEOCR VENV KONTROLU
:: ===================================================
echo [2/7] PaddleOCR venv kontrolu...
echo.

if not exist "paddle_service\venv\Scripts\python.exe" (
    echo [HATA] PaddleOCR venv bulunamadi!
    echo        paddle_service\venv\Scripts\python.exe eksik
    echo.
    echo        Cozum: PaddleOCR klasorunde venv olustur
    echo        cd paddle_service
    echo        python -m venv venv
    echo        venv\Scripts\activate.bat
    echo        pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo [OK] PaddleOCR venv hazir.
echo.

:: ===================================================
:: 3. BACKEND VENV KONTROLU
:: ===================================================
echo [3/7] Backend venv kontrolu...
echo.

if not exist "backend\venv\Scripts\python.exe" (
    echo [HATA] Backend venv bulunamadi!
    echo        backend\venv\Scripts\python.exe eksik
    echo.
    echo        Cozum: Backend klasorunde venv olustur
    echo        cd backend
    echo        python -m venv venv
    echo        venv\Scripts\activate.bat
    echo        pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo [OK] Backend venv hazir.
echo.

:: ===================================================
:: 4. FRONTEND NODE_MODULES KONTROLU
:: ===================================================
echo [4/7] Frontend node_modules kontrolu...
echo.

if not exist "frontend\node_modules" (
    echo [HATA] Frontend node_modules bulunamadi!
    echo        npm install gerekiyor
    echo.
    echo        Cozum: Frontend klasorunde npm install calistir
    echo        cd frontend
    echo        npm install
    echo.
    pause
    exit /b 1
)

echo [OK] Frontend node_modules hazir.
echo.

:: ===================================================
:: 5. PADDLEOCR MIKROSERVIS BASLATILIYOR
:: ===================================================
echo [5/7] PaddleOCR Mikroservis baslatiliyor...
echo.

start "PADDLEOCR MIKROSERVIS - Port 8001" cmd /k "cd /d "%PROJECT_DIR%paddle_service" && venv\Scripts\activate.bat && echo ======================================== && echo   PADDLEOCR CALISIYOR - PORT 8001 && echo ======================================== && echo. && python main.py"

:: PaddleOCR'in baslamasini bekle (4 saniye)
echo [*] PaddleOCR baslatildi. Hazir olana kadar bekleniyor...
timeout /t 4 /nobreak >nul

:: PaddleOCR'in calisip calismadigini kontrol et
netstat -ano | findstr ":8001" >nul 2>&1
if !errorlevel! neq 0 (
    echo [UYARI] PaddleOCR baslamiyor olabilir. Terminal penceresini kontrol et.
    echo.
) else (
    echo [OK] PaddleOCR calisiyor (Port 8001)
    echo.
)

:: ===================================================
:: 6. BACKEND BASLATILIYOR
:: ===================================================
echo [6/7] Backend baslatiliyor...
echo.

start "BACKEND - Ana API (Port 8000)" cmd /k "cd /d "%PROJECT_DIR%backend" && venv\Scripts\activate.bat && echo ======================================== && echo   BACKEND CALISIYOR - PORT 8000 && echo ======================================== && echo. && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Backend'in baslamasini bekle (5 saniye)
echo [*] Backend baslatildi. Hazir olana kadar bekleniyor...
timeout /t 5 /nobreak >nul

:: Backend'in calisip calismadigini kontrol et
netstat -ano | findstr ":8000" >nul 2>&1
if !errorlevel! neq 0 (
    echo [UYARI] Backend baslamiyor olabilir. Terminal penceresini kontrol et.
    echo.
) else (
    echo [OK] Backend calisiyor (Port 8000)
    echo.
)

:: ===================================================
:: 7. FRONTEND BASLATILIYOR
:: ===================================================
echo [7/7] Frontend baslatiliyor...
echo.

start "FRONTEND - Port 5173" cmd /k "cd /d "%PROJECT_DIR%frontend" && echo ======================================== && echo   FRONTEND CALISIYOR - PORT 5173 && echo ======================================== && echo. && npm run dev"

:: Frontend'in baslamasini bekle (8 saniye)
echo [*] Frontend baslatildi. Hazir olana kadar bekleniyor...
timeout /t 8 /nobreak >nul

:: Frontend'in calisip calismadigini kontrol et
netstat -ano | findstr ":5173" >nul 2>&1
if !errorlevel! neq 0 (
    echo [UYARI] Frontend baslamiyor olabilir. Terminal penceresini kontrol et.
    echo.
) else (
    echo [OK] Frontend calisiyor (Port 5173)
    echo.
)

:: ===================================================
:: SISTEM HAZIR!
:: ===================================================
cls
echo.
echo =========================================================
echo    TUM SERVISLER BASARIYLA BASLATILDI!
echo =========================================================
echo.
echo    [PADDLEOCR] http://localhost:8001
echo    [BACKEND]   http://localhost:8000
echo    [FRONTEND]  http://localhost:5173
echo    [API DOCS]  http://localhost:8000/docs
echo.
echo =========================================================
echo    SERVIS DETAYLARI
echo =========================================================
echo.
echo    1. PaddleOCR Mikroservis (Port 8001)
echo       - Sanal Ortam: paddle_service\venv
echo       - Gorev: PaddleOCR modelini calistir
echo.
echo    2. Backend - Ana API (Port 8000)
echo       - Sanal Ortam: backend\venv
echo       - Gorev: OpenAI, Google DocAI, AWS Textract
echo       - PaddleOCR ile haberlesme
echo.
echo    3. Frontend (Port 5173)
echo       - Node.js ile calisir
echo       - Gorev: Kullanici arayuzu
echo.
echo =========================================================
echo    KULLANIM TALIMATLARI
echo =========================================================
echo.
echo    1. Tarayicida su adresi ac:
echo       http://localhost:5173
echo.
echo    2. Hard Refresh yap (ilk acilista):
echo       CTRL + SHIFT + R
echo.
echo    3. Kullanilabilir Ozellikler:
echo       - 4 Model Karsilastirmasi (OpenAI, Google, AWS, Paddle)
echo       - Kirpma ve Etiketleme
echo       - Fis Datasi Sistemi
echo       - Toplu Yukleme
echo.
echo =========================================================
echo    KAPATMAK ICIN
echo =========================================================
echo.
echo    - DURDUR.bat dosyasini calistir
echo    - Veya acilan 3 terminal penceresini kapat (X butonu)
echo.
echo =========================================================
echo.
echo    3 terminal penceresi acik kalmali!
echo    Minimize edebilirsin ama kapatma.
echo.
echo =========================================================
echo.

echo.
echo Simdi http://localhost:5173 adresini tarayicida ac!
echo.
pause
