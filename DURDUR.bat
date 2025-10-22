@echo off
title Fis Okuma OCR - Sistemi Durdur
color 0C

cls
echo.
echo =========================================================
echo    TUM SERVISLER DURDURULUYOR...
echo =========================================================
echo.

:: Port 8001'deki processleri durdur (PaddleOCR)
echo [1/5] Port 8001 (PaddleOCR Mikroservis) kapatiliyor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] Port 8001 temizlendi.
echo.

:: Port 8000'deki processleri durdur (Backend)
echo [2/5] Port 8000 (Backend) kapatiliyor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] Port 8000 temizlendi.
echo.

:: Port 5173'teki processleri durdur (Frontend)
echo [3/5] Port 5173 (Frontend) kapatiliyor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] Port 5173 temizlendi.
echo.

:: Tum Python processleri
echo [4/5] Python processleri kapatiliyor...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM pythonw.exe 2>nul
echo [OK] Python processleri temizlendi.
echo.

:: Tum Node processleri
echo [5/5] Node processleri kapatiliyor...
taskkill /F /IM node.exe 2>nul
echo [OK] Node processleri temizlendi.
echo.

echo =========================================================
echo    TUM SERVISLER DURDURULDU!
echo =========================================================
echo.
echo    Kapanan Servisler:
echo    - PaddleOCR Mikroservis (8001)
echo    - Backend API (8000)
echo    - Frontend (5173)
echo.
echo    Yeniden baslatmak icin BAŞLAT.bat dosyasini calistir.
echo.
pause
