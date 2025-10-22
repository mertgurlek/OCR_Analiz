# 🚀 GitHub'a Yükleme Rehberi

Bu dosya projeyi GitHub'a nasıl yükleyeceğinizi adım adım anlatır.

## ✅ Hazırlık Tamamlandı

Aşağıdaki dosyalar GitHub için hazırlandı:

- ✅ `.gitignore` - Güvenlik (API keys, venv, node_modules)
- ✅ `.gitattributes` - Line ending ayarları
- ✅ `LICENSE` - MIT Lisansı
- ✅ `README.md` - Proje dokümantasyonu
- ✅ `.env.example` - API key şablonu
- ✅ `PROJECT_HISTORY.md` - Geliştirme notları

## 🔒 Güvenlik Kontrolü

**UYARI:** Push yapmadan önce kontrol edin:

```bash
# .env dosyasının git'te OLMADIĞINI doğrula
git status | findstr ".env"
# Çıktı: .env.example (sadece .env.example olmalı, .env OLMAMALI)
```

## 📦 GitHub'a Yükleme Adımları

### 1️⃣ Değişiklikleri Stage'e Al

```bash
# Mevcut dizin kontrolü
cd "c:\Users\Mert\OneDrive - Uyumsoft\Masaüstü\Fis_okuma_ab_testi"

# Tüm değişiklikleri ekle
git add .

# Stage'deki dosyaları kontrol et
git status
```

### 2️⃣ Commit Yap

```bash
# Anlamlı bir commit mesajı ile kaydet
git commit -m "feat: Proje temizliği ve GitHub hazırlığı

- Eski markdown dosyaları PROJECT_HISTORY.md'de birleştirildi
- Kullanılmayan migration scriptleri kaldırıldı
- .gitignore güncellendi (prompt history, test images)
- .gitattributes eklendi (line ending kontrolü)
- LICENSE eklendi (MIT)
- README güncel"
```

### 3️⃣ GitHub'da Repository Oluştur

**GitHub.com'da:**
1. https://github.com/new adresine git
2. Repository adı: `fis-okuma-ocr-ab-testi`
3. Açıklama: `Muhasebe fişlerini 4 farklı OCR modeliyle karşılaştırma platformu`
4. Public veya Private seç
5. ❌ **README, .gitignore, LICENSE ekleme** (zaten var)
6. "Create repository" butonuna bas

### 4️⃣ Remote Ekle ve Push Yap

```bash
# GitHub'dan kopyaladığın URL'i kullan
git remote add origin https://github.com/KULLANICI_ADI/fis-okuma-ocr-ab-testi.git

# Ana branch'i main olarak ayarla (isteğe bağlı)
git branch -M main

# Push yap
git push -u origin main
```

### 5️⃣ GitHub'da Kontrol Et

Repository sayfasında görünmeli:
- ✅ README.md otomatik gösteriliyor
- ✅ LICENSE dosyası tanınıyor
- ✅ .env dosyası YOK (güvenlik ✓)
- ✅ venv/ ve node_modules/ YOK

## 🔄 Sonraki Güncellemeler İçin

```bash
# Değişiklikleri ekle
git add .

# Commit yap
git commit -m "fix: açıklama"

# Push yap
git push
```

## 📝 Commit Mesajı Formatı

**Önerilen format:**
```
<tip>: <kısa açıklama>

<detaylı açıklama (isteğe bağlı)>
```

**Tipler:**
- `feat:` - Yeni özellik
- `fix:` - Hata düzeltme
- `docs:` - Dokümantasyon
- `style:` - Kod formatı
- `refactor:` - Kod iyileştirme
- `test:` - Test ekleme
- `chore:` - Bakım işleri

**Örnekler:**
```bash
git commit -m "feat: Dual VAT calculation eklendi"
git commit -m "fix: PaddleOCR connection timeout sorunu"
git commit -m "docs: README kurulum adımları güncellendi"
```

## 🚨 Acil Durum: .env Yanlışlıkla Push Edildi

**Eğer .env'yi yanlışlıkla push ettiyseniz:**

```bash
# 1. Dosyayı git'ten kaldır (fiziksel dosya kalır)
git rm --cached backend/.env

# 2. .gitignore'a ekle (zaten var ama kontrol et)
echo "backend/.env" >> .gitignore

# 3. Commit yap
git commit -m "fix: .env dosyası repository'den kaldırıldı"

# 4. Push yap
git push

# 5. ÖNEMLİ: Tüm API keylerini HEMEN yenile!
# - OpenAI API key
# - AWS credentials
# - Google Cloud credentials
```

## 🎯 GitHub Repository Ayarları (Önerilen)

**Settings > General:**
- ✅ Issues aktif (bug tracking için)
- ✅ Discussions kapalı (gerekirse açabilirsin)

**Settings > Security:**
- ✅ Dependabot alerts aktif
- ✅ Secret scanning aktif (Public repo'larda otomatik)

**Settings > Pages:**
- ⏸️ Kapalı (web app değil, geliştirme platformu)

## 📊 README Badges (Opsiyonel)

GitHub'da README'ye ekleyebileceğin badgeler:

```markdown
![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)
![React](https://img.shields.io/badge/React-18.2-61dafb.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
```

## ✅ Başarılı Push Kontrolü

Push başarılı olduysa:
1. ✅ GitHub'da kod görünüyor
2. ✅ README düzgün render ediliyor
3. ✅ LICENSE MIT olarak tanınıyor
4. ✅ .env dosyası YOK
5. ✅ Diğer geliştiriciler clone edip çalıştırabilir

---

**Hazır mısın?** Yukarıdaki adımları takip et! 🚀
