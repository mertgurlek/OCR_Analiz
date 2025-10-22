# 🐼 PaddleOCR Mikroservis

## Amaç
PaddleOCR'ı ana backend'den izole ederek protobuf çakışmasını önlemek.

## Mimari
```
Ana Backend (Port 8000)          PaddleOCR Servis (Port 8001)
├── Google DocAI                 └── PaddleOCR
├── Amazon Textract                  └── Protobuf 3.20.2
├── OpenAI Vision
└── HTTP Client → PaddleOCR
    └── Protobuf 4.25.8
```

## Kurulum

### 1. Sanal Ortam Oluştur
```powershell
cd paddle_service
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Bağımlılıkları Yükle
```powershell
pip install -r requirements.txt
```

### 3. Servisi Başlat
```powershell
python main.py
```

Servis `http://localhost:8001` adresinde çalışacak.

## API Endpoints

### Health Check
```bash
GET http://localhost:8001/
GET http://localhost:8001/health
```

### OCR İşlemi
```bash
POST http://localhost:8001/ocr/process
Content-Type: multipart/form-data
Body: file=@image.jpg
```

**Response:**
```json
{
  "success": true,
  "text": "Extracted text...",
  "line_count": 10,
  "confidence": 0.95,
  "metadata": {
    "model": "PaddleOCR",
    "language": "en",
    "lines": ["line1", "line2"],
    "confidences": [0.98, 0.92]
  }
}
```

## Test

### Manuel Test
```powershell
# Servis çalışıyor mu?
curl http://localhost:8001/health

# OCR testi
curl -X POST http://localhost:8001/ocr/process -F "file=@test.jpg"
```

## Avantajlar
✅ Protobuf çakışması yok
✅ Bağımsız ölçeklendirme
✅ İzole hata yönetimi
✅ Kolay bakım

## Notlar
- Ana backend ile aynı anda çalışmalı
- Port 8001 kullanılmalı (ana backend 8000)
- İlk OCR işlemi yavaş olabilir (model yükleme)
