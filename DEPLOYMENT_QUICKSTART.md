# ⚡ Hızlı Deployment - Railway + Vercel

5 dakikada deploy edin!

## 🚀 Hızlı Adımlar

### 1️⃣ GitHub'a Push (1 dk)

```bash
git add .
git commit -m "feat: Production deployment ready"
git push origin main
```

### 2️⃣ Railway - Backend (2 dk)

1. https://railway.app/ → GitHub ile giriş
2. "New Project" → "Deploy from GitHub"
3. Repo seçin, **Root directory: `backend`**
4. **Variables** ekleyin:
   ```
   OPENAI_API_KEY=sk-xxx
   PORT=8000
   DEBUG=False
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
5. Deploy → URL'i kopyalayın

### 3️⃣ Railway - PaddleOCR (1 dk)

1. Aynı projede "New Service"
2. Aynı repo, **Root: `paddle_service`**
3. Deploy → URL'i kopyalayın
4. Backend'e dön, variable ekle:
   ```
   PADDLEOCR_SERVICE_URL=https://paddle-xxx.railway.app
   ```

### 4️⃣ Vercel - Frontend (1 dk)

1. https://vercel.com/ → GitHub ile giriş
2. "New Project" → Repo import et
3. **Root: `frontend`**, Framework: Vite
4. **Environment Variable:**
   ```
   VITE_API_URL=https://backend-xxx.railway.app
   ```
5. Deploy → URL'i kopyalayın
6. Railway'e dön, backend ALLOWED_ORIGINS'e ekle

---

## ✅ Test

1. Vercel URL'i aç: `https://your-app.vercel.app`
2. Fiş yükle
3. OCR çalıştır
4. ✨ Çalışıyor!

---

## 📋 Gerekli URL'ler

| Servis | URL | Nereden? |
|--------|-----|----------|
| Backend | `https://backend-xxx.railway.app` | Railway backend deployment |
| PaddleOCR | `https://paddle-xxx.railway.app` | Railway paddle deployment |
| Frontend | `https://your-app.vercel.app` | Vercel deployment |

---

## 💡 Environment Variables Özet

**Railway Backend:**
```env
OPENAI_API_KEY=sk-xxx
ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:5173
PORT=8000
DEBUG=False
PADDLEOCR_SERVICE_URL=https://paddle-xxx.railway.app
```

**Railway PaddleOCR:**
```env
PORT=8001
```

**Vercel Frontend:**
```env
VITE_API_URL=https://backend-xxx.railway.app
```

---

Detaylı adımlar için: **DEPLOYMENT_GUIDE.md**
