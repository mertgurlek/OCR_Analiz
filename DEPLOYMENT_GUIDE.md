# 🚀 Deployment Rehberi - Railway + Vercel

Bu rehber, uygulamanızı ücretsiz cloud platformlarına nasıl deploy edeceğinizi gösterir.

## 📋 Deployment Planı

- **Backend API** → Railway (ücretsiz $5/ay kredit)
- **PaddleOCR Mikroservis** → Railway (ayrı servis)
- **Frontend** → Vercel (ücretsiz)

---

## 🔧 Ön Hazırlık

### 1️⃣ GitHub'a Push

Önce projeyi GitHub'a yükleyin:

```bash
# Değişiklikleri commit edin
git add .
git commit -m "feat: Deployment konfigürasyonları eklendi"

# GitHub'a push edin
git push origin main
```

---

## 🚂 ADIM 1: Backend'i Railway'e Deploy Et

### 1. Railway Hesabı Oluştur

1. https://railway.app/ adresine gidin
2. "Start a New Project" → "Deploy from GitHub repo"
3. GitHub hesabınızla giriş yapın

### 2. Backend Servisi Oluştur

1. **"New Project"** tıklayın
2. **"Deploy from GitHub repo"** seçin
3. Repository'nizi seçin
4. **Root Directory:** `/backend` olarak ayarlayın

### 3. Environment Variables Ekleyin

Railway dashboard'da **"Variables"** sekmesine gidin:

```bash
# OpenAI (Zorunlu)
OPENAI_API_KEY=sk-your-openai-key-here

# Google Cloud Document AI (İsteğe Bağlı)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us
GOOGLE_CLOUD_PROCESSOR_ID=your-processor-id
GOOGLE_APPLICATION_CREDENTIALS=credentials.json

# AWS Textract (İsteğe Bağlı)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Database
DATABASE_URL=sqlite+aiosqlite:///./ocr_test.db

# Server
PORT=8000
HOST=0.0.0.0
DEBUG=False

# CORS - Vercel domain'inizi ekleyin (deploy sonrası)
ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:5173

# PaddleOCR Service URL (sonra ekleyeceğiz)
PADDLEOCR_SERVICE_URL=http://localhost:8001
```

### 4. Deploy

- Railway otomatik deploy başlatacak
- **Deploy logs**'u kontrol edin
- Deploy tamamlandığında **URL** kopyalayın (örn: `https://backend-production-xxxx.up.railway.app`)

### 5. Domain Ayarları (Opsiyonel)

- **Settings** → **Networking** → **Generate Domain**
- Otomatik domain oluşturulacak

---

## 🐼 ADIM 2: PaddleOCR'ı Railway'e Deploy Et

### 1. Yeni Servis Oluştur

1. Aynı projede **"New Service"** tıklayın
2. **"Deploy from GitHub repo"** seçin
3. Aynı repository'yi seçin
4. **Root Directory:** `/paddle_service` olarak ayarlayın

### 2. Environment Variables

```bash
PORT=8001
HOST=0.0.0.0
```

### 3. Deploy ve URL Al

- Deploy tamamlandığında URL'i kopyalayın
- Backend'e geri dönün ve `PADDLEOCR_SERVICE_URL` değişkenini güncelleyin:
  ```
  PADDLEOCR_SERVICE_URL=https://paddle-production-xxxx.up.railway.app
  ```

---

## 🌐 ADIM 3: Frontend'i Vercel'e Deploy Et

### 1. Vercel Hesabı Oluştur

1. https://vercel.com/ adresine gidin
2. GitHub ile giriş yapın

### 2. Yeni Proje Oluştur

1. **"Add New Project"** tıklayın
2. Repository'nizi import edin
3. **Root Directory:** `frontend` olarak ayarlayın
4. **Framework Preset:** Vite otomatik algılanacak

### 3. Environment Variables

**"Environment Variables"** bölümünde:

```bash
VITE_API_URL=https://backend-production-xxxx.up.railway.app
```

⚠️ **Önemli:** Railway'den aldığınız backend URL'ini buraya yapıştırın!

### 4. Build Settings Kontrol

Otomatik algılanmalı:
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 5. Deploy

- **"Deploy"** tıklayın
- 2-3 dakika içinde deploy tamamlanacak
- Vercel size bir URL verecek: `https://your-app.vercel.app`

---

## ✅ ADIM 4: CORS Ayarları

### Backend'i Güncelle

1. Railway backend dashboard'a gidin
2. **Variables** → `ALLOWED_ORIGINS` değişkenini bulun
3. Vercel URL'inizi ekleyin:
   ```
   ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:5173
   ```
4. Backend otomatik yeniden deploy olacak

---

## 🧪 ADIM 5: Test Et

### Frontend Testi

1. Vercel URL'inizi tarayıcıda açın: `https://your-app.vercel.app`
2. Bir fiş görseli yükleyin
3. OCR analizi çalıştırın
4. 4 model sonuçlarını kontrol edin

### Backend Health Check

```bash
curl https://backend-production-xxxx.up.railway.app/health
```

Yanıt: `{"status":"ok"}`

### API Docs

```
https://backend-production-xxxx.up.railway.app/docs
```

---

## 📊 Deployment Özeti

Başarılı deployment sonrası:

| Servis | Platform | URL |
|--------|----------|-----|
| Frontend | Vercel | `https://your-app.vercel.app` |
| Backend | Railway | `https://backend-production-xxxx.up.railway.app` |
| PaddleOCR | Railway | `https://paddle-production-xxxx.up.railway.app` |

---

## 🔄 Güncellemeler

### Kod Değişikliği Yaptığınızda

```bash
# Değişiklikleri commit edin
git add .
git commit -m "fix: bug düzeltmesi"
git push origin main
```

- **Railway:** Otomatik deploy başlar
- **Vercel:** Otomatik deploy başlar
- Her iki platform da GitHub'ı izliyor

---

## 💰 Maliyet

### Railway (Backend + PaddleOCR)

- **Ücretsiz Tier:** $5/ay kredi
- Hafif kullanımda ücretsiz
- Orta kullanım: ~$5-10/ay

### Vercel (Frontend)

- **Hobby Plan:** Tamamen ücretsiz
- Bandwidth: 100GB/ay
- Yeterli olacak

### Toplam: $0-10/ay

---

## 🚨 Sorun Giderme

### Backend Deploy Edilmiyor

**Logs kontrol:**
- Railway dashboard → Deployments → Logs
- Python hatalarını kontrol et
- `requirements.txt` eksik paket var mı?

### Frontend Backend'e Bağlanamıyor

**CORS hatası:**
- Railway'de `ALLOWED_ORIGINS` doğru mu?
- Vercel URL'i tam olarak yazıldı mı?

**API URL yanlış:**
- Vercel environment variables kontrol et
- `VITE_API_URL` Railway backend URL'i mi?

### Database Hatası

Railway SQLite kullanıyor, her deploy'da sıfırlanabilir.

**Kalıcı database için:**
- Railway PostgreSQL ekleyin (ücretsiz 500MB)
- Backend'de SQLAlchemy PostgreSQL connection string'i kullanın

---

## 🎯 Production İyileştirmeleri (Opsiyonel)

### 1. Custom Domain

**Vercel:**
- Settings → Domains → Add Domain
- DNS kayıtlarını ayarlayın

**Railway:**
- Settings → Networking → Custom Domain

### 2. PostgreSQL Database (Kalıcı)

```bash
# Railway'de PostgreSQL servisi ekle
# Otomatik DATABASE_URL oluşturulacak

# Backend requirements.txt'e ekle:
psycopg2-binary==2.9.9

# database.py'yi güncelle (SQLite yerine PostgreSQL)
```

### 3. File Upload Storage

Railway'de dosyalar geçici, kalıcı storage için:
- **AWS S3** (ücretli)
- **Cloudinary** (ücretsiz tier var)

### 4. Monitoring

- **Sentry.io** - Error tracking (ücretsiz)
- **LogDNA/Datadog** - Log management

---

## 📝 Checklist

Deploy tamamlandığında:

- [ ] Backend Railway'de çalışıyor
- [ ] PaddleOCR Railway'de çalışıyor  
- [ ] Frontend Vercel'de çalışıyor
- [ ] CORS ayarları doğru
- [ ] Environment variables set edildi
- [ ] API anahtarları eklendi
- [ ] Frontend backend'e bağlanıyor
- [ ] OCR analizi çalışıyor
- [ ] 4 model test edildi

---

**🎉 Deploy tamamlandı! Uygulamanız artık online!**

Sorularınız için: GitHub Issues veya dokümantasyon
