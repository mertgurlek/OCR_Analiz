# 🔧 FİŞ OKUMA OCR PROJESİ - TEKNİK DETAY RAPORU

**Rapor Türü:** Teknik Mimari ve İş Akışları  
**Tarih:** Ekim 2025

---

## İÇİNDEKİLER

1. [Sistem Mimarisi Detayları](#sistem-mimarisi)
2. [İş Akışları ve Basamaklar](#iş-akışları)
3. [Teknik Püf Noktaları](#püf-noktaları)
4. [Veri Modeli](#veri-modeli)
5. [API Endpoint'leri](#api-endpoints)
6. [Optimizasyonlar](#optimizasyonlar)

---

## 1. SİSTEM MİMARİSİ DETAYLARI

### 1.1 Base Class Pattern (Kalıtım Yapısı)

**Tasarım Prensibi:** Tüm OCR servisleri `BaseOCRService` sınıfından türetilir.

```python
# backend/app/services/base.py
class BaseOCRService(ABC):
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model_name = "base"
        self.pricing = {
            "per_page": 0.0,
            "per_1k_tokens": 0.0
        }
    
    @abstractmethod
    async def process_image(self, image_bytes, prompt=None) -> Dict:
        pass
    
    async def analyze(self, image_bytes, prompt=None) -> Dict:
        # Ön işleme
        processed_bytes, meta = self.preprocess_image(image_bytes)
        # OCR işleme
        result = await self.process_image(processed_bytes, prompt)
        # Maliyet hesaplama
        cost = self.calculate_cost(result)
        return {...}
```

**Avantajlar:**
- ✅ Kod tekrarı önlenir
- ✅ Standart interface
- ✅ Kolay yeni model ekleme
- ✅ Test edilebilirlik

**Türetilmiş Sınıflar:**
1. `OpenAIVisionService` → GPT-4o Vision
2. `GoogleDocAIService` → Document AI
3. `AmazonTextractService` → Textract
4. `PaddleOCRService` → PaddleOCR client

### 1.2 Mikroservis Mimarisi

**Problem:** Google Cloud SDK ve PaddleOCR arasında protobuf versiyon çakışması

**Çözüm:**
```
Backend (Port 8000)          PaddleOCR Mikroservis (Port 8001)
├─ venv1/                    ├─ venv2/
│  ├─ google-cloud-*         │  ├─ paddleocr
│  ├─ boto3                  │  ├─ paddlepaddle
│  ├─ openai                 │  └─ (izole ortam)
│  └─ fastapi                └─ FastAPI wrapper
```

**İletişim:**
```python
# Backend → PaddleOCR HTTP request
response = await http_client.post(
    "http://localhost:8001/ocr",
    files={"file": image_bytes}
)
```

### 1.3 Paralel İşleme (asyncio Pattern)

**Kod:**
```python
# 4 modeli paralel çalıştır
tasks = [
    openai_service.analyze(image_bytes, prompt),
    google_service.analyze(image_bytes),
    amazon_service.analyze(image_bytes),
    paddle_service.analyze(image_bytes)
]

results = await asyncio.gather(*tasks, return_exceptions=True)
```

**Performans:**
- Sıralı: 3.2 + 1.2 + 0.8 + 2.5 = 7.7 saniye
- Paralel: max(3.2, 1.2, 0.8, 2.5) = 3.2 saniye
- **Kazanç: %58 daha hızlı**

---

## 2. İŞ AKIŞLARI VE BASAMAKLAR

### 2.1 Ana Karşılaştırma Akışı

```
[Kullanıcı]
    ↓
[1] Fiş Yükleme (drag-drop veya dosya seç)
    ↓
[2] Kırpma (opsiyonel - 4 köşe ayarlanabilir)
    ↓
[3] Model Seçimi (4 model veya seçili modeller)
    ↓
[4] Prompt Seçimi (OpenAI için)
    ↓
[5] "Analiz Et" Butonu
    ↓
    ┌─────────────────────────────────────┐
    │    BACKEND - Paralel İşleme         │
    ├─────────────────────────────────────┤
    │ [6a] OpenAI Vision                  │
    │      ↓ OCR + GPT Muhasebe           │
    │      ↓ 3.2s, $0.008                 │
    │                                     │
    │ [6b] Google DocAI                   │
    │      ↓ OCR + Entity Extraction      │
    │      ↓ 1.2s, $0.0015                │
    │                                     │
    │ [6c] Amazon Textract                │
    │      ↓ OCR + Forms                  │
    │      ↓ 0.8s, $0.015                 │
    │                                     │
    │ [6d] PaddleOCR                      │
    │      ↓ Local OCR                    │
    │      ↓ 2.5s, $0.00                  │
    └─────────────────────────────────────┘
    ↓
[7] GPT Muhasebe Analizi (her model için)
    ↓ Extract line items, VAT breakdown
    ↓ Paralel (asyncio.gather)
    ↓
[8] Dual VAT Validation
    ↓ GPT beyanı vs Kod hesaplaması
    ↓
[9] Database Kayıt
    ↓ analyses, ocr_results tablolarına
    ↓
[10] Frontend Görüntüleme
    ↓ 4 sütun yan yana
    ↓ OCR metni, yapılandırılmış veri, muhasebe
    ↓
[11] Manuel Değerlendirme
    ↓ Her model için ✅/⚠️/❌
    ↓ Hata tipi: OCR/GPT/Both/None
    ↓
[12] Değerlendirme Kaydet
    ↓ model_evaluations tablosuna
    ↓ Unique constraint kontrolü
    ↓
[13] İstatistik Güncelleme
    ✓ Otomatik hesaplanan metrikler
```

### 2.2 Fiş Kütüphanesi Akışı

```
[1] Toplu Fiş Yükleme
    ↓ Birden fazla fiş tek seferde
    ↓
[2] File Hash Kontrolü
    ↓ MD5 hash ile duplicate engelleme
    ↓
[3] Database Kayıt (receipts tablosu)
    ↓ name, category, tags
    ↓
[4] Kırpma İşlemi (opsiyonel)
    ↓ 4 köşe sürüklenebilir
    ↓ Kırpılmış görsel ayrı kaydedilir
    ↓ is_cropped = true
    ↓
[5] Ground Truth Girişi (opsiyonel)
    ↓ Manuel doğru veri
    ↓ has_ground_truth = true
    ↓
[6] Fiş Seçip Test Etme
    ↓ Ana karşılaştırma akışına girer
```

### 2.3 Prompt Test Akışı

```
[1] Fiş kütüphanesinden fiş seç
    ↓
[2] "Prompt Testi Ekle" butonu
    ↓
[3] Modal açılır
    ↓ Model seç (openai_vision)
    ↓ Prompt versiyon seç veya custom gir
    ↓
[4] Test Et
    ↓ OCR + GPT analizi
    ↓
[5] Sonuç Görüntüleme
    ↓ OCR metni
    ↓ Muhasebe verisi
    ↓ Maliyet, süre
    ↓
[6] Etiketleme
    ↓ Doğru/Yanlış/Kısmi
    ↓ Hata tipi
    ↓ Notlar
    ↓
[7] Kaydet (prompt_tests tablosu)
    ↓ Tekrar kontrolü: aynı receipt_id + model + version varsa güncelle
```

---

## 3. TEKNİK PÜF NOKTALARI

### 3.1 Unique Constraint ile Tekrar Önleme

**Problem:** Aynı analiz için birden fazla değerlendirme kaydediliyor

**Çözüm:**
```python
# models.py
class ModelEvaluation(Base):
    __table_args__ = (
        Index('idx_unique_analysis_model', 
              'analysis_id', 'model_name', 
              unique=True),
    )
```

**Sonuç:** Database seviyesinde garanti, tekrar kayıt imkansız

### 3.2 Dual VAT Validation

**Konsept:** GPT'nin beyanı güvenilir mi?

**Yöntem 1: GPT Beyanı**
```python
# GPT'nin döndürdüğü
vat_breakdown_gpt = [
    {"vatRate": 10, "taxBase": 1000, "vatAmount": 100},
    {"vatRate": 18, "taxBase": 500, "vatAmount": 90}
]
```

**Yöntem 2: Kod Bazlı Hesaplama**
```python
def calculate_vat_from_items(items):
    vat_groups = {}
    for item in items:
        rate = item['vatRate']
        gross = item['grossAmount']
        
        # KDV dahil formül
        vat = gross / (1 + rate/100) * (rate/100)
        base = gross - vat
        
        if rate not in vat_groups:
            vat_groups[rate] = {'base': 0, 'vat': 0}
        
        vat_groups[rate]['base'] += base
        vat_groups[rate]['vat'] += vat
    
    return vat_groups
```

**Karşılaştırma:**
```typescript
// Frontend
if (Math.abs(gpt_vat - calculated_vat) < 0.5) {
  color = "blue-purple gradient" // Tutarlı
} else {
  color = "orange-red gradient"  // Tutarsız
}
```

### 3.3 Custom Hooks ile State Yönetimi

**Problem:** 22 useState hook, kod karmaşık

**Çözüm:**
```typescript
// hooks/useFileUpload.ts
export const useFileUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [croppedFile, setCroppedFile] = useState<File | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  
  return {
    selectedFile, croppedFile, showCropper,
    selectFile: setSelectedFile,
    cropFile: setCroppedFile,
    toggleCropper: () => setShowCropper(!showCropper),
    clearFiles: () => {
      setSelectedFile(null)
      setCroppedFile(null)
    }
  }
}

// Kullanım
const fileState = useFileUpload()
```

**Sonuç:** 22 → 11 useState, %50 kod azalması

### 3.4 Prompt Versiyonlama

**Sistem:**
```python
# backend/app/services/prompt_manager.py
class PromptManager:
    def __init__(self):
        self.prompts = {
            "openai_vision": {
                1: {"prompt": "...", "schema": "v1"},
                2: {"prompt": "...", "schema": "v1"},
                3: {"prompt": "...", "schema": "v2"}  # KDV detaylı
            }
        }
    
    def get_prompt(self, model_name, version=None):
        if version is None:
            version = max(self.prompts[model_name].keys())
        return self.prompts[model_name][version]
```

**Avantaj:**
- ✅ A/B testing kolay
- ✅ Rollback mümkün
- ✅ İstatistiksel karşılaştırma

### 3.5 Image Preprocessing

**Amaç:** Tüm modeller için standart görsel hazırlığı

```python
def preprocess_image(self, image_bytes):
    image = Image.open(io.BytesIO(image_bytes))
    
    # RGB'ye çevir
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Çok büyük görselleri küçült (max 4096px)
    if max(image.size) > 4096:
        ratio = 4096 / max(image.size)
        new_size = tuple(int(dim * ratio) for dim in image.size)
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    
    # PNG formatına çevir
    output = io.BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()
```

**Püf Noktaları:**
- RGB zorunlu (bazı modeller RGBA kabul etmez)
- 4096px limit (API limitleri)
- LANCZOS resampling (en kaliteli)
- PNG format (kayıpsız)

---

## 4. VERİ MODELİ

### 4.1 Database Schema

```sql
-- Ana analiz kaydı
CREATE TABLE analyses (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    upload_timestamp DATETIME,
    prompt TEXT,
    total_cost FLOAT,
    evaluated BOOLEAN DEFAULT 0,
    notes TEXT
);

-- Her modelin OCR sonucu
CREATE TABLE ocr_results (
    id TEXT PRIMARY KEY,
    analysis_id TEXT REFERENCES analyses(id),
    model_name TEXT NOT NULL,
    text_content TEXT,
    structured_data JSON,
    confidence_score FLOAT,
    processing_time_ms FLOAT,
    estimated_cost FLOAT,
    error TEXT
);

-- Manuel değerlendirmeler
CREATE TABLE model_evaluations (
    id TEXT PRIMARY KEY,
    analysis_id TEXT REFERENCES analyses(id),
    model_name TEXT NOT NULL,
    is_correct BOOLEAN,
    notes TEXT,
    evaluated_at DATETIME,
    UNIQUE(analysis_id, model_name)  -- Tekrar önleme
);

-- Fiş kütüphanesi
CREATE TABLE receipts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    original_image_path TEXT,
    cropped_image_path TEXT,
    is_cropped BOOLEAN DEFAULT 0,
    file_hash TEXT UNIQUE,  -- Duplicate önleme
    ground_truth_data JSON,
    has_ground_truth BOOLEAN DEFAULT 0,
    tags JSON,
    test_count INTEGER DEFAULT 0
);

-- Prompt testleri
CREATE TABLE prompt_tests (
    id TEXT PRIMARY KEY,
    receipt_id TEXT REFERENCES receipts(id),
    model_name TEXT,
    prompt_version INTEGER,
    ocr_text TEXT,
    accounting_data JSON,
    label TEXT,  -- correct/incorrect/partial
    error_type TEXT,  -- ocr_error/gpt_error/both/none
    created_at DATETIME
);
```

### 4.2 JSON Schema Örnekleri

**Muhasebe Verisi (V2 Schema):**
```json
{
  "metadata": {
    "merchant": "SHELL AKARYAKIT",
    "date": "2025-01-16",
    "receiptNumber": "12345",
    "vkn": "1234567890"
  },
  "document": {
    "rawText": "Tam fiş metni..."
  },
  "items": [
    {
      "description": "Motorin",
      "quantity": 50.5,
      "unit": "Lt",
      "unitPrice": 34.50,
      "grossAmount": 1742.25,
      "vatRate": 10,
      "vatAmount": 158.39
    }
  ],
  "totals": {
    "vatBreakdown": [
      {
        "vatRate": 10,
        "taxBase": 1583.86,
        "vatAmount": 158.39
      }
    ],
    "totalVat": 158.39,
    "grandTotal": 1742.25
  }
}
```

---

## 5. API ENDPOINT'LERİ

### 5.1 OCR Karşılaştırma

```http
POST /api/receipts/compare
Content-Type: multipart/form-data

file: [image file]
models: ["openai_vision", "google_docai", "amazon_textract", "paddle_ocr"]
prompt: "custom prompt text"

Response:
{
  "analysis_id": "uuid",
  "results": [
    {
      "model_name": "openai_vision",
      "text_content": "...",
      "structured_data": {...},
      "accounting_data": {...},
      "processing_time_ms": 3200,
      "estimated_cost": 0.008,
      "confidence_score": 0.95
    },
    ...
  ]
}
```

### 5.2 Manuel Değerlendirme

```http
POST /api/receipts/analyses/{analysis_id}/evaluate

{
  "evaluations": [
    {
      "model_name": "openai_vision",
      "is_correct": true,
      "error_type": "none",
      "notes": "Mükemmel sonuç"
    },
    ...
  ]
}

Response:
{
  "message": "Değerlendirme kaydedildi",
  "updated_evaluations": [...]
}
```

### 5.3 İstatistikler

```http
GET /api/receipts/prompt-tests/statistics

Response:
{
  "total_tests": 150,
  "labeled_tests": 120,
  "correct_tests": 95,
  "model_stats": [
    {
      "model_name": "openai_vision",
      "total_tests": 50,
      "correct_tests": 48,
      "accuracy_rate": 96.0,
      "avg_processing_time_ms": 3200,
      "avg_ocr_cost": 0.008,
      "avg_gpt_cost": 0.001
    },
    ...
  ],
  "model_prompt_stats": [...],
  "error_stats": {
    "ocr_errors": 10,
    "gpt_errors": 8,
    "both_errors": 2,
    "no_errors": 95
  }
}
```

---

## 6. OPTİMİZASYONLAR

### 6.1 Frontend Optimizasyonları

**1. React.memo ile Gereksiz Render'ları Önleme**
```typescript
export const ComparisonCard = React.memo(({ result }) => {
  return <div>...</div>
}, (prevProps, nextProps) => {
  return prevProps.result.id === nextProps.result.id
})
```

**2. useCallback ile Function Memoization**
```typescript
const handleAnalyze = useCallback(async () => {
  await analyzeReceipt(file)
}, [file])
```

**3. Lazy Loading**
```typescript
const Statistics = React.lazy(() => import('./pages/Statistics'))
const ReceiptLibrary = React.lazy(() => import('./pages/ReceiptLibrary'))
```

### 6.2 Backend Optimizasyonları

**1. Async Database Queries**
```python
# Paralel database işlemleri
receipts_task = db.execute(select(Receipt))
analyses_task = db.execute(select(Analysis))

receipts, analyses = await asyncio.gather(
    receipts_task, analyses_task
)
```

**2. Connection Pooling**
```python
# SQLAlchemy async engine
engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20
)
```

**3. Response Streaming (büyük sonuçlar için)**
```python
@router.get("/stream")
async def stream_results():
    async def generate():
        for result in results:
            yield json.dumps(result) + "\n"
    
    return StreamingResponse(generate())
```

### 6.3 Maliyet Optimizasyonları

**1. Image Compression**
```python
# Gereksiz yüksek çözünürlük → maliyet artışı
if image.size[0] > 2048:
    image.thumbnail((2048, 2048), Image.LANCZOS)
```

**2. Token Limiti**
```python
# OpenAI max_tokens sınırı
max_tokens=1500  # Gereksiz uzun yanıtları önle
```

**3. Caching (aynı fiş tekrar test edilirse)**
```python
cache_key = f"{file_hash}_{model_name}_{prompt_hash}"
if cache_key in redis_cache:
    return redis_cache.get(cache_key)
```

---

## 7. HATA YÖNETİMİ VE LOGLAMABest Practices:**

```python
# Structured logging
logger.info(f"🚀 Processing image with {model_name}")
logger.debug(f"   Image size: {image.size}")
logger.warning(f"⚠️ Low confidence: {confidence}")
logger.error(f"❌ OCR failed: {error}", exc_info=True)
```

**Exception Handling Pattern:**
```python
try:
    result = await ocr_service.process(image)
except APITimeoutError:
    logger.error("API timeout")
    return {"error": "Timeout", "retry": True}
except RateLimitError:
    logger.error("Rate limit")
    await asyncio.sleep(60)
    return {"error": "Rate limit", "retry": True}
except Exception as e:
    logger.exception("Unexpected error")
    return {"error": str(e), "retry": False}
```

---

## 8. DEPLOYMENT NOTLARI

### 8.1 Gerekli Ortam Değişkenleri

```bash
# backend/.env
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
GOOGLE_CLOUD_PROJECT_ID=project-id
GOOGLE_CLOUD_PROCESSOR_ID=processor-id
GOOGLE_CREDENTIALS_PATH=./credentials.json
DATABASE_URL=sqlite+aiosqlite:///./ocr_test.db
```

### 8.2 Production Checklist

- [ ] API anahtarları .env'de
- [ ] .env dosyası .gitignore'da
- [ ] Database backup stratejisi
- [ ] Error monitoring (Sentry vb.)
- [ ] Rate limiting
- [ ] CORS ayarları
- [ ] HTTPS zorunlu
- [ ] File upload size limiti
- [ ] SQL injection koruması
- [ ] Input validation

---

## SONUÇ

Bu platform, 4 OCR modelini karşılaştırmak için sağlam bir altyapı sunar. Mikroservis mimarisi, paralel işleme, dual validation ve kapsamlı metriklerle production-ready bir çözümdür.

**Teknik Güçlü Yönler:**
- ✅ Modüler mimari (yeni model eklemek kolay)
- ✅ Async/await ile performans
- ✅ Database unique constraints ile veri kalitesi
- ✅ Comprehensive error handling
- ✅ İstatistiksel analiz yetenekleri

**Geliştirme Potansiyeli:**
- 🔄 Redis caching
- 🔄 Docker containerization
- 🔄 Kubernetes orchestration
- 🔄 ML-based routing
- 🔄 Real-time notifications
