# 📊 Fiş Okuma OCR A/B Test Platformu

> Muhasebe fişlerini 4 farklı OCR modeliyle karşılaştırarak en iyi çözümü bulmanıza yardımcı olan AR-GE platformu.

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

---

## 📋 İçindekiler

- [Proje Amacı](#-proje-amacı)
- [Özellikler](#-temel-özellikler)
- [Hızlı Başlangıç](#-hızlı-başlangıç-5-dakika)
- [Kurulum](#-detaylı-kurulum)
- [Kullanım](#-kullanım-kılavuzu)
- [Proje Yapısı](#-proje-yapısı)
- [Teknoloji Stack](#-teknoloji-stack)
- [Katkıda Bulunma](#-katkıda-bulunma)

---

## 🎯 Proje Amacı

Bu platform, muhasebe müşavirlerinin fişleri otomatik olarak sisteme aktarabilmesi için **en uygun OCR modelini seçmelerine** yardımcı olur. 4 farklı OCR çözümünü doğruluk, maliyet ve hız açısından karşılaştırır.

---

## ✨ Temel Özellikler

### 🤖 4 OCR Modeli Standart Paket

1. **🤖 OpenAI Vision (GPT-4o)**
   - En akıllı model
   - Custom prompt desteği
   - JSON yapılandırılmış çıktı
   - Maliyet: ~$0.008/görsel

2. **📄 Google Document AI**
   - Google'ın güçlü OCR'ı
   - Tablolarda mükemmel
   - Entity recognition
   - Maliyet: $0.0015/sayfa

3. **🔍 Amazon Textract**
   - AWS'nin hızlı servisi
   - Forms ve key-value pairs
   - En hızlı işlem (~800ms)
   - Maliyet: $0.015/sayfa

4. **🐼 PaddleOCR**
   - Ücretsiz yerel model
   - Açık kaynak
   - API key gerektirmez
   - Maliyet: $0.00

### 📈 Kapsamlı Metrikler

- 💰 **Gerçek zamanlı maliyet** hesaplama
- ⏱️ **İşlem süresi** karşılaştırması
- 🎯 **Güven skoru** (confidence)
- ✓ **Manuel doğruluk** değerlendirmesi
- 📊 **Detaylı istatistikler**

### 🎨 Modern Özellikler

- ✅ **4 Model Paralel Test** - Hızlı karşılaştırma (~10 saniye)
- ✅ **Fiş Kütüphanesi** - Fişleri kaydet, etiketle, düzenle
- ✅ **Gelişmiş Kırpma** - 4 köşeden ayarlanabilir kırpma
- ✅ **Ground Truth** - Referans veriler ile otomatik değerlendirme
- ✅ **Prompt Testleri** - Farklı GPT prompt'larını test et
- ✅ **Muhasebe Analizi** - JSON formatında yapılandırılmış veri
- ✅ **İstatistikler** - Kapsamlı performans analizi
- ✅ **Responsive Arayüz** - Modern React + TailwindCSS

---

## ⚡ Hızlı Başlangıç (5 Dakika)

### Gereksinimler

- Python 3.9+
- Node.js 16+
- En az bir OCR API anahtarı (önerilen: OpenAI)

### 1️⃣ Tek Tıkla Başlatma (Önerilen)

```batch
# Tüm servisleri başlat (3 terminal penceresi açılır)
BAŞLAT.bat
```

**Ne olur?**
1. ✅ Port kontrolü ve temizleme (8000, 8001, 5173)
2. ✅ Sanal ortam kontrolü (2 ayrı venv)
3. ✅ PaddleOCR Mikroservis → Port 8001
4. ✅ Backend API → Port 8000
5. ✅ Frontend → Port 5173
6. ✅ Otomatik sağlık kontrolü

**Servisleri durdurmak için:**
```batch
DURDUR.bat
```

### 2️⃣ Tarayıcıda Aç

```
http://localhost:5173
```

İlk açılışta **CTRL + SHIFT + R** yaparak hard refresh edin.

### 3️⃣ İlk Testi Yap

1. Sol panelden fiş görseli yükle (sürükle-bırak)
2. 4 model paralel çalışır (~10 saniye)
3. Sonuçları karşılaştır
4. Doğru okuyanları işaretle
5. "Değerlendirmeyi Kaydet" butonuna bas

✅ **İlk testiniz tamamlandı!**

---

## 🛠️ Detaylı Kurulum

### Adım 1: Projeyi İndir

```bash
git clone <repository-url>
cd fis_okuma_ab_testi
```

### Adım 2: Backend Kurulumu

```bash
# Backend dizinine git
cd backend

# Sanal ortam oluştur
python -m venv venv

# Aktifleştir (Windows)
venv\Scripts\activate

# Bağımlılıkları yükle
pip install -r requirements.txt
```

### Adım 3: PaddleOCR Mikroservis Kurulumu

```bash
# Paddle service dizinine git
cd paddle_service

# Ayrı sanal ortam oluştur (ÖNEMLİ!)
python -m venv venv

# Aktifleştir
venv\Scripts\activate

# Bağımlılıkları yükle
pip install -r requirements.txt
```

**Neden ayrı venv?** PaddleOCR ve Google Cloud SDK'nın protobuf çakışması var.

### Adım 4: Frontend Kurulumu

```bash
# Frontend dizinine git
cd frontend

# Bağımlılıkları yükle
npm install
```

### Adım 5: API Anahtarları

`backend/.env` dosyasını oluşturun (`.env.example`'dan kopyalayın):

```env
# Zorunlu (en az 1 tane)
OPENAI_API_KEY=sk-your-key-here

# İsteğe bağlı
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1

GOOGLE_CLOUD_PROJECT_ID=your-project
GOOGLE_CLOUD_PROCESSOR_ID=your-processor
GOOGLE_CREDENTIALS_PATH=path/to/credentials.json

# Database
DATABASE_URL=sqlite:///./ocr_test.db
```

### Adım 6: Manuel Başlatma

**Terminal 1 - PaddleOCR:**
```bash
cd paddle_service
venv\Scripts\activate
python main.py
```

**Terminal 2 - Backend:**
```bash
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## 📖 Kullanım Kılavuzu

### Ana Özellikler

#### 1. 🔄 4 Model Karşılaştırma

**Sol Panel:**
- Fiş yükle (sürükle-bırak, kamera, fiş kütüphanesi)
- Modelleri seç/kaldır
- Prompt ayarla (OpenAI için)

**Orta Panel:**
- 4 modelin sonuçları yan yana
- OCR metni, yapılandırılmış veri, muhasebe bilgileri
- Maliyet, süre, confidence gösterimi

**Sağ Panel:**
- Geçmiş testler
- Son 20 analiz
- Detaylı görüntüleme

**Alt Panel:**
- Doğruluk değerlendirmesi
- Her model için checkbox
- Not ekleme
- Kaydetme

#### 2. 📚 Fiş Kütüphanesi

- **Toplu Yükleme**: Birden fazla fiş tek seferde
- **Kategori/Etiket**: Organize etme
- **Kırpma**: 4 köşeden ayarlanabilir kırpma sistemi
- **Ground Truth**: Referans veri yönetimi
- **Prompt Testleri**: Her fiş için farklı prompt testleri

**Kırpma Sistemi:**
1. Fiş seç
2. "Kırp" butonuna tıkla
3. 4 köşeyi sürükle
4. "Kırpmayı Kaydet"
5. Artık testlerde kırpılmış görsel kullanılacak

#### 3. 🧪 Prompt Testleri

- **Amaç**: Farklı GPT prompt'larını test et
- **Nasıl**:
  1. Fiş kütüphanesinden fiş seç
  2. "Prompt Testi Ekle"
  3. Prompt'u yaz
  4. Test et ve sonuçları kaydet
- **Değerlendirme**: Doğru/Yanlış etiketleme
- **Analiz**: Hangi prompt daha iyi çalışıyor?

#### 4. 📊 İstatistikler

- **Genel İstatistikler**: Toplam test, fiş, model başarı oranları
- **Model Bazlı**: Her modelin performansı
- **Maliyet Analizi**: Toplam ve ortalama maliyetler
- **Prompt Performansı**: En başarılı prompt'lar

#### 5. 💾 Muhasebe Sistemi

Her OCR sonucu şu formatta yapılandırılır:

```json
{
  "merchant": "Market Adı",
  "date": "2025-01-16",
  "total": 150.75,
  "tax": 27.14,
  "items": [
    {"name": "Süt", "quantity": 2, "price": 15.50},
    {"name": "Ekmek", "quantity": 1, "price": 5.00}
  ],
  "payment_method": "Nakit",
  "receipt_number": "12345"
}
```

---

## 🏗️ Proje Yapısı

```
fis_okuma_ab_testi/
├── backend/                     # FastAPI Backend
│   ├── app/
│   │   ├── main.py             # Ana uygulama
│   │   ├── api/                # API endpoints
│   │   │   └── receipts.py     # Fiş API'leri
│   │   ├── services/           # OCR servisleri
│   │   │   ├── base.py         # Base sınıf
│   │   │   ├── google_docai.py
│   │   │   ├── amazon_textract.py
│   │   │   ├── paddle_ocr.py
│   │   │   ├── openai_vision.py
│   │   │   ├── accounting_service.py
│   │   │   └── prompt_manager.py
│   │   ├── models/             # Veri modelleri
│   │   │   └── schemas.py      # Pydantic schemas
│   │   ├── database/           # Veritabanı
│   │   │   ├── models.py       # SQLAlchemy models
│   │   │   └── database.py     # DB connection
│   │   └── core/               # Konfigürasyon
│   │       └── config.py
│   ├── prompts/                # GPT prompt'ları
│   ├── uploads/                # Yüklenen görseller
│   ├── ocr_test.db            # SQLite database
│   ├── requirements.txt
│   └── .env                   # API anahtarları
│
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── App.tsx            # Ana component
│   │   ├── components/        # UI components
│   │   │   ├── FileUpload.tsx
│   │   │   ├── ComparisonResults.tsx
│   │   │   ├── HistoryPanel.tsx
│   │   │   ├── ImageCropper.tsx
│   │   │   ├── SingleModelTest.tsx
│   │   │   └── ui/            # Shadcn/ui components
│   │   ├── pages/             # Sayfalar
│   │   │   ├── ReceiptLibrary.tsx
│   │   │   └── Statistics.tsx
│   │   ├── api/
│   │   │   └── client.ts      # API calls
│   │   ├── types/
│   │   │   └── index.ts       # TypeScript types
│   │   └── utils/
│   │       └── logger.ts
│   ├── package.json
│   └── tailwind.config.js
│
├── paddle_service/             # PaddleOCR Mikroservis
│   ├── main.py                # FastAPI mikroservis
│   ├── venv/                  # Ayrı sanal ortam
│   └── requirements.txt
│
├── BAŞLAT.bat                 # Otomatik başlatma
├── DURDUR.bat                 # Otomatik durdurma
└── README.md                  # Bu dosya
```

---

## 🔧 Teknoloji Stack

### Backend
- **Framework**: FastAPI 0.109 - Modern async web framework
- **Database**: SQLAlchemy + SQLite (async)
- **Image Processing**: Pillow, OpenCV
- **OCR SDKs**:
  - google-cloud-documentai 2.24
  - boto3 1.34 (Textract)
  - paddleocr 2.7.3
  - openai 1.10

### Frontend
- **Framework**: React 18.2 + TypeScript 5.3
- **Build Tool**: Vite 5.0
- **Styling**: TailwindCSS 3.4
- **UI Components**: Radix UI (Shadcn/ui)
- **HTTP Client**: Axios 1.6
- **Icons**: Lucide React

### Database Schema

**7 Ana Tablo:**
1. `analyses` - Test analizleri
2. `ocr_results` - OCR sonuçları
3. `receipts` - Fiş kütüphanesi
4. `receipt_metadata` - Kırpma ve etiket bilgileri
5. `prompt_tests` - Prompt testleri
6. `accounting_analyses` - Muhasebe analizleri
7. `prompt_test_results` - Test sonuçları

---

## 💡 Kullanım Senaryoları

### Senaryo 1: Model Seçimi

**Amaç**: 100 fiş ile en iyi modeli bul

1. 100 farklı fiş topla (market, restoran, akaryakıt)
2. Fiş kütüphanesine yükle
3. Her birini 4 modelle test et
4. Doğru okuyanları işaretle
5. İstatistiklere bak
6. Karar ver

**Örnek Sonuç**:
- OpenAI Vision: 95% doğruluk, $0.80 toplam
- Google DocAI: 92% doğruluk, $0.15 toplam
- Amazon Textract: 88% doğruluk, $1.50 toplam
- PaddleOCR: 75% doğruluk, $0.00 toplam

### Senaryo 2: Prompt Optimizasyonu

**Amaç**: En iyi GPT prompt'unu bul

1. 20 fiş seç
2. 5 farklı prompt yaz
3. Her prompt'u test et
4. Sonuçları karşılaştır
5. En iyisini prod'a al

### Senaryo 3: Maliyet Analizi

**Amaç**: Aylık maliyet hesapla

1. Ortalama aylık fiş sayısı: 10,000
2. Her model için test maliyet: $0.008 (OpenAI)
3. Aylık maliyet: 10,000 × $0.008 = **$80**
4. Yıllık: **$960**

---

## 📊 Örnek Performans Metrikleri

| Model | Doğruluk | Ort. Maliyet | Ort. Süre | Güçlü Yönler |
|-------|----------|--------------|-----------|--------------|
| OpenAI Vision | 95% | $0.008 | 3.2s | Prompt ile optimize |
| Google DocAI | 92% | $0.0015 | 1.2s | Tablolarda mükemmel |
| Amazon Textract | 88% | $0.015 | 0.8s | En hızlı |
| PaddleOCR | 75% | $0.00 | 2.5s | Ücretsiz |

---

## 🚨 Sorun Giderme

### Backend Başlamıyor

```bash
# Sanal ortamı manuel aktifleştir
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload

# Eğer port 8000 kullanımdaysa
python -m uvicorn app.main:app --reload --port 8001
```

### Frontend Başlamıyor

```bash
cd frontend
npm install  # Paketleri tekrar yükle
npm run dev
```

### PaddleOCR Çalışmıyor

```bash
cd paddle_service
venv\Scripts\activate
pip install paddlepaddle paddleocr
python main.py
```

### API Key Hatası

- `backend/.env` dosyasında API key var mı kontrol et
- Başında/sonunda boşluk olmamalı
- Tırnak işareti kullanma

### Port Çakışması

```bash
# Hangi portlar kullanımda?
netstat -ano | findstr "8000 8001 5173"

# Portu değiştir
# backend/.env → PORT=8002
# frontend/vite.config.ts → port: 5174
```

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

---

## 📄 Lisans

MIT License

---

## 📞 İletişim

Sorularınız için issue açabilirsiniz.

---

**⭐ Projeyi beğendiyseniz yıldız vermeyi unutmayın!**

---

## 🎉 Özellikler Özeti

✅ **4 OCR Model** Karşılaştırma  
✅ **Paralel İşleme** (~10 saniye)  
✅ **Fiş Kütüphanesi** (Kaydet, Düzenle, Etiketle)  
✅ **Gelişmiş Kırpma** (4 köşe ayarlanabilir)  
✅ **Ground Truth** Yönetimi  
✅ **Prompt Testleri** (A/B Testing)  
✅ **Muhasebe Analizi** (JSON çıktı)  
✅ **Gerçek Zamanlı Metrikler** (Maliyet, Süre, Doğruluk)  
✅ **İstatistikler** (Kapsamlı raporlama)  
✅ **Modern UI** (React + TailwindCSS)  
✅ **Responsive** Tasarım  
✅ **Dark Mode** Desteği  

**Platform, muhasebe fişlerini OCR ile okumak için en iyi çözümü bulmanıza yardımcı olur!** 🚀
