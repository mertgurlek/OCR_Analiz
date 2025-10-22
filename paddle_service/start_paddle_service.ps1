# PaddleOCR Mikroservis Başlatma Scripti
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🐼 PaddleOCR Mikroservis Başlatılıyor..." -ForegroundColor Cyan
Write-Host "Port: 8001" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Sanal ortamı aktifleştir
if (Test-Path ".\venv\Scripts\Activate.ps1") {
    Write-Host "✓ Sanal ortam aktifleştiriliyor..." -ForegroundColor Green
    .\venv\Scripts\Activate.ps1
} else {
    Write-Host "❌ Sanal ortam bulunamadı!" -ForegroundColor Red
    Write-Host "Lütfen önce şu komutu çalıştırın:" -ForegroundColor Yellow
    Write-Host "  python -m venv venv" -ForegroundColor White
    Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "  pip install -r requirements.txt" -ForegroundColor White
    exit 1
}

# .env dosyası kontrolü
if (-not (Test-Path ".env")) {
    Write-Host "⚠ .env dosyası bulunamadı, .env.example kopyalanıyor..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# Servisi başlat
Write-Host ""
Write-Host "🚀 Servis başlatılıyor..." -ForegroundColor Green
Write-Host "URL: http://localhost:8001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Durdurmak için Ctrl+C" -ForegroundColor Gray
Write-Host ""

python main.py
