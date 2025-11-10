"""
Muhasebe analiz prompt'larını versiyonlu olarak yöneten servis
"""
import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
import tiktoken

logger = logging.getLogger(__name__)


class PromptManager:
    """Model bazında muhasebe analiz prompt'larını yönetir"""
    
    def __init__(self, storage_path: str = "prompts"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(exist_ok=True)
        # Token encoding for GPT-4
        try:
            self.encoding = tiktoken.encoding_for_model("gpt-4")
        except:
            self.encoding = tiktoken.get_encoding("cl100k_base")
        
        # Varsayılan prompt'lar - HER MODEL İÇİN ÖZELLEŞTİRİLMİŞ
        self.default_prompts = {
            "paddle_ocr": {
                "version": 2,
                "schema_version": "v1",  # V1 = eski flat schema
                "created_at": datetime.now().isoformat(),
                "prompt": """⚠️ KRİTİK - PaddleOCR ÖZEL TALİMATLAR:

Bu OCR çıktısı PaddleOCR (açık kaynak, yerel model) tarafından üretildi ve YÜKSEK HATA ORANI içerir.

🔴 BİLİNEN SORUNLAR:
1. **Türkçe Karakter Hataları** (Çok Yaygın):
   - ı → i, I → l, İ → I
   - ş → s, Ş → S  
   - ğ → g, Ğ → G
   - ü → u, Ü → U
   - ö → o, Ö → O
   - ç → c, Ç → C
   Örnek: "Şoför" → "Sofor", "Çiğköfte" → "Cigkofte", "İçecek" → "Icecek"

2. **Satır Tekrarları**: Aynı ürün 2-3 kez yazdırılmış olabilir (OCR çift okuma)
   - Aynı isim, aynı fiyat → TEK satır yap
   - Toplam tutarla karşılaştır, mantık kontrolü yap

3. **Sayı Okuma Hataları**:
   - 0 → O, 5 → S, 8 → B, 1 → I, 7 → T gibi karışmalar
   - Virgül/nokta karışımı: "123.45" → "12345" veya "123,45" → "12345"
   - **TUTARLARA EXTRA DİKKAT ET**, mantıklı değerler olmalı

4. **Satır Sırası Karışık**: Metinde satırlar karışmış olabilir
   - TOPLAM, VKN, TARİH gibi kritik bilgileri DİKKATLE ara
   - Sayısal desenlere odaklan (örn: 10 haneli VKN, TL tutarlar)

🟢 STRATEJİN:
- **Toleranslı Eşleştirme**: "Motorin" = "Motorın" = "Motorm" gibi yakın isimleri birleştir
- **Akıllı Düzeltme**: Türkçe kelime bilgisini kullan ("Icecek" -> "İçecek")
- **Matematik Kontrolü**: line_items toplamı ~= grand_total (+/-%2 hata payı)
- **Şüpheli Veriler**: Eğer bir değer çok saçmaysa NULL bırak
- **Duplicate Detection**: Aynı tutar/isim gördüğünde, tekrar mı yoksa farklı ürün mü kontrol et

🎯 ÖNCELİK:
1. VKN (10 haneli sayı deseni ara)
2. Toplam tutar (en büyük sayı genelde toplam)
3. Tarih (DD/MM/YYYY veya DD.MM.YYYY deseni)
4. KDV oranları (%8, %10, %18, %20)
5. Ürün isimleri (Türkçe düzeltme uygula)"""
            },
            "openai_vision": {
                "version": 2,
                "schema_version": "v1",  # V1 = eski flat schema
                "created_at": datetime.now().isoformat(),
                "prompt": """✅ YÜKSEK KALİTE - OpenAI Vision (GPT-4o) ÖZEL TALİMATLAR:

Bu OCR çıktısı GPT-4o Vision tarafından üretildi - SİSTEMİN EN DOĞRU ve AKILLI modeli.

🟢 GÜÇLÜ YÖNLER:
1. **Context Anlama**: Fişin yapısını, semantiğini anlayabilir
2. **Türkçe Desteği**: Türkçe karakterleri doğru okur
3. **Akıllı Yorumlama**: Belirsiz bilgileri context'ten çıkarabilir
4. **Yüksek Doğruluk**: Sayılar, tarihler, VKN genellikle %98+ doğru
5. **Yapısal Anlama**: Tablo, liste yapılarını iyi tanır

🎯 STRATEJİN:
- **Güvenle Parse Et**: Bu çıktıya doğrudan güvenebilirsin
- **Minimal Düzeltme**: Türkçe karakter hatası olma ihtimali çok düşük
- **Semantic Extraction**: Eğer "Toplam", "Genel Toplam", "Ödenecek" gibi farklı ifadeler varsa, context'e göre grand_total'ı bul
- **KDV Ayrıştırma**: KDV oranları metinde açıkça belirtilmişse kesin çıkar, yoksa tutar bazlı hesapla
- **Ürün Gruplandırma**: Kategorileri (yakıt, yiyecek, vs) anlayabilir, gerekirse gruplayabilir

⚠️ DİKKAT:
- Bazen çok detaylı bilgi verir, gereksiz detayları filtrele
- JSON formatında değil, düz metin formatında olabilir (sen parse et)
- Sayısal değerleri NUMBER olarak çıkar (string YASAK)

🔢 HESAPLAMA KONTROLÜ:
- Bu model bile hata yapabilir, toplam kontrolü yap
- line_items toplamı = grand_total eşitliği MUTLAKA kontrol et
- KDV hesaplaması doğru mu kontrol et"""
            },
            "google_docai": {
                "version": 2,
                "schema_version": "v1",  # V1 = eski flat schema
                "created_at": datetime.now().isoformat(),
                "prompt": """✅ PROFESYONEL KALİTE - Google Document AI ÖZEL TALİMATLAR:

Bu OCR çıktısı Google Document AI tarafından üretildi - YAPI ve TABLO TANIMA konusunda çok güçlü.

🟢 GÜÇLÜ YÖNLER:
1. **Entity Extraction**: VKN, tarih, tutar gibi entity'leri otomatik çıkarır
2. **Tablo Tanıma**: Fatura tablo yapılarını mükemmel tanır
3. **Form Processing**: Form alanlarını (label-value) iyi eşleştirir
4. **Sayısal Doğruluk**: Tutarlar %95+ doğrudur
5. **Çok Dilli**: Türkçe karakterleri iyi destekler

📋 ÖZEL FORMAT:
- Çıktı genellikle YAPI İÇİNDE gelir (entities, tables, key-value pairs)
- "entities" bölümünde VKN, tarih, tutar gibi alanlar çıkarılmış olabilir
- "tables" bölümünde satır-sütun yapısında ürünler olabilir

🎯 STRATEJİN:
- **Yapısal Parse**: Eğer structured_data varsa önce oraya bak
- **Entity Mapping**: VKN için "tax_id" veya "vkn" entity'sine bak
- **Tablo İşleme**: Tablo yapısı varsa, sütun başlıklarına göre (Ürün, Miktar, Fiyat, Toplam) parse et
- **Confidence Kullan**: Her entity confidence'ı var, düşük confidence'lı verileri şüpheyle karşıla
- **Eksik Bilgi**: Entity bulunamazsa raw text'ten manuel çıkar

⚠️ DİKKAT:
- Bazen aynı bilgi hem entity hem de text'te olabilir (çakışma kontrol et)
- Tablo yapısı karmaşıksa, satır-sütun eşleştirmesinde dikkatli ol
- Türkçe karakter hatası nadir ama olabilir

🔢 HESAPLAMA:
- Tablo varsa, satır toplamlarını kontrol et
- KDV breakdown genelde tabloda ayrı gösterilir
- grand_total = subtotal + total_vat eşitliğini kontrol et"""
            },
            "amazon_textract": {
                "version": 2,
                "schema_version": "v1",  # V1 = eski flat schema
                "created_at": datetime.now().isoformat(),
                "prompt": """✅ HIZLI ve GÜVENİLİR - Amazon Textract ÖZEL TALİMATLAR:

Bu OCR çıktısı Amazon Textract tarafından üretildi - HIZLI ve BASİT text extraction.

🟢 GÜÇLÜ YÖNLER:
1. **Hız**: En hızlı OCR modellerinden biri
2. **Form/Tablo**: Form alanları ve tablo yapılarını tanır
3. **Text Blocks**: Metni LINE bazında döndürür (düzenli)
4. **Key-Value Pairs**: Etiket-değer eşleştirmesi yapar
5. **Consistency**: Çıktı formatı tutarlı ve tahmin edilebilir

📋 FORMAT ÖZELLİĞİ:
- Çıktı LINE bazında (satır satır metin)
- Genelde düz metin, minimal yapı
- Koordinat bilgisi yok (sadece text)
- Bazen form key-value pairs çıkarılmış olabilir

🎯 STRATEJİN:
- **Satır Satır Parse**: Metni LINE bazında işle
- **Pattern Matching**: VKN (10 haneli), tarih (DD/MM/YYYY), tutar (123.45 TL) desenlerine odaklan
- **Keyword Search**: "TOPLAM", "KDV", "ARA TOPLAM", "VKN" gibi anahtar kelimeleri ara
- **Sayısal Extraction**: En büyük sayı genelde grand_total'dır
- **Context Awareness**: "Toplam:" kelimesinden sonraki sayı muhtemelen toplam tutardır

⚠️ DİKKAT:
- Türkçe karakter desteği %80-90 civarında (hata olabilir)
- Bazı satırlar eksik veya bölük pörçük olabilir
- Tablo yapısı bozuk olabilir (satırlar karışık)
- Yapısal bilgi minimal, senin yorumlaman gerekiyor

🔢 HESAPLAMA KONTROL:
- line_items toplamını manuel hesapla
- Eğer "KDV %10: 15.50" gibi satır varsa, oranı ve tutarı çıkar
- grand_total ile line_items toplamını karşılaştır
- Tutarsızlık varsa en güvenilir değeri kullan (genelde fişin en altındaki toplam)

🧠 AKILLI ÇÖZÜMLEİ:
- "Motorin 50.5 Lt 34.50 1742.25" gibi satırda:
  * İlk kelime: ürün adı (Motorin)
  * Sayı + birim: miktar (50.5 Lt)
  * İkinci sayı: birim fiyat (34.50)
  * Üçüncü sayı: toplam (1742.25)
- VKN format: 10 haneli sayı (boşluksuz)
- Tarih format: DD/MM/YYYY veya DD.MM.YYYY"""
            }
        }
        
        # İlk açılışta dosyalar yoksa oluştur
        self._initialize_prompts()
    
    def _initialize_prompts(self):
        """Varsayılan prompt dosyalarını oluştur"""
        for model_name, data in self.default_prompts.items():
            file_path = self.storage_path / f"{model_name}.json"
            if not file_path.exists():
                self._save_prompt_file(model_name, data)
    
    def _get_prompt_file_path(self, model_name: str) -> Path:
        """Model için prompt dosya yolunu döner"""
        return self.storage_path / f"{model_name}.json"
    
    def _save_prompt_file(self, model_name: str, data: Dict):
        """Prompt'u dosyaya kaydet"""
        file_path = self._get_prompt_file_path(model_name)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def _load_prompt_file(self, model_name: str) -> Optional[Dict]:
        """Prompt'u dosyadan yükle"""
        file_path = self._get_prompt_file_path(model_name)
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading prompt for {model_name}: {e}", exc_info=True)
            return None
    
    def _load_json_files(self, pattern: str, directory: Optional[Path] = None) -> List[Dict]:
        """
        Belirtilen pattern'e uyan JSON dosyalarını yükler
        
        Args:
            pattern: Glob pattern (örn: "model_name_v*.json")
            directory: Aranacak dizin (None ise self.storage_path kullanılır)
            
        Returns:
            Yüklenmiş JSON objelerinin listesi
        """
        search_dir = directory if directory else self.storage_path
        if not search_dir.exists():
            return []
        
        files = sorted(search_dir.glob(pattern))
        result = []
        
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    result.append(data)
            except Exception as e:
                logger.error(f"Error loading JSON file {file_path}: {e}")
                continue
        
        return result
    
    def get_prompt(self, model_name: str, version: Optional[int] = None) -> Dict:
        """
        Model için prompt'u getir
        
        Args:
            model_name: Model adı
            version: Versiyon numarası (None ise güncel versiyon)
            
        Returns:
            Prompt verisi
        """
        # Belirli bir versiyon istendiyse
        if version is not None:
            versioned_data = self.load_version(model_name, version)
            if versioned_data:
                return versioned_data
        
        # Güncel versiyonu yükle
        data = self._load_prompt_file(model_name)
        
        # Dosya yoksa varsayılan prompt'u kullan
        if not data:
            if model_name in self.default_prompts:
                return self.default_prompts[model_name]
            else:
                # Genel varsayılan
                return {
                    "version": 1,
                    "schema_version": "v1",
                    "created_at": datetime.now().isoformat(),
                    "prompt": "OCR metnini dikkatli analiz et ve yapılandırılmış muhasebe verisi çıkar."
                }
        
        return data
    
    def save_prompt(self, model_name: str, new_prompt: str, schema_version: Optional[str] = None) -> Dict:
        """
        Yeni prompt'u kaydet ve versiyon artır
        
        Args:
            model_name: Model adı
            new_prompt: Yeni prompt metni
            schema_version: Schema versiyonu (None ise otomatik belirlenir)
            
        Returns:
            Kaydedilen prompt verisi
        """
        # Mevcut prompt'u yükle
        current_data = self._load_prompt_file(model_name)
        
        if not current_data:
            # İlk kayıt
            new_version = 1
        else:
            # Versiyon artır
            new_version = current_data.get("version", 1) + 1
        
        # Schema version belirle
        if schema_version is None:
            schema_version = self._determine_schema_version(new_version)
        
        # Yeni veriyi hazırla
        new_data = {
            "version": new_version,
            "schema_version": schema_version,
            "created_at": datetime.now().isoformat(),
            "prompt": new_prompt,
            "previous_version": current_data.get("version") if current_data else None
        }
        
        # Geçmişe kaydet (opsiyonel)
        if current_data:
            history_path = self.storage_path / "history"
            history_path.mkdir(exist_ok=True)
            history_file = history_path / f"{model_name}_v{current_data.get('version')}.json"
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(current_data, f, indent=2, ensure_ascii=False)
        
        # Yeni prompt'u kaydet
        self._save_prompt_file(model_name, new_data)
        
        return new_data
    
    def restore_version(self, model_name: str, version: int) -> Dict:
        """Eski bir versiyonu mevcut versiyon olarak geri yükle"""
        # Hedef versiyonu yükle
        target_version = self.load_version(model_name, version)
        if not target_version:
            raise ValueError(f"Version {version} not found for {model_name}")
        
        # Mevcut versiyonu history'e kaydet
        current_data = self._load_prompt_file(model_name)
        if current_data:
            history_path = self.storage_path / "history"
            history_path.mkdir(exist_ok=True)
            history_file = history_path / f"{model_name}_v{current_data.get('version')}.json"
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(current_data, f, indent=2, ensure_ascii=False)
        
        # Hedef versiyonu yeni versiyon numarasıyla kaydet
        new_version = current_data.get("version", 0) + 1 if current_data else 1
        restored_data = {
            "version": new_version,
            "created_at": datetime.now().isoformat(),
            "prompt": target_version["prompt"],
            "previous_version": current_data.get("version") if current_data else None,
            "restored_from_version": version
        }
        
        # Kaydet
        self._save_prompt_file(model_name, restored_data)
        
        return restored_data
    
    def get_prompt_history(self, model_name: str) -> List[Dict]:
        """Model için prompt geçmişini getir (tüm versiyonlar)"""
        history_path = self.storage_path / "history"
        
        # History'den tüm versiyonları yükle (utility fonksiyon kullanarak)
        history = self._load_json_files(
            pattern=f"{model_name}_v*.json",
            directory=history_path
        )
        
        # Mevcut versiyonu da ekle
        current = self._load_prompt_file(model_name)
        if current:
            history.append(current)
        
        return sorted(history, key=lambda x: x.get("version", 0), reverse=True)
    
    def get_all_prompts(self) -> Dict[str, Dict]:
        """Tüm modellerin prompt'larını getir"""
        result = {}
        
        # Tüm JSON dosyalarını tara
        for file_path in self.storage_path.glob("*.json"):
            model_name = file_path.stem
            data = self._load_prompt_file(model_name)
            if data:
                result[model_name] = data
        
        # Eksik olanları varsayılanlardan ekle
        for model_name in self.default_prompts.keys():
            if model_name not in result:
                result[model_name] = self.default_prompts[model_name]
        
        return result
    
    def load_version(self, model_name: str, version: int) -> Optional[Dict]:
        """Belirli bir versiyon numarasını yükle"""
        # Önce history'den bak
        history_path = self.storage_path / "history"
        if history_path.exists():
            history_file = history_path / f"{model_name}_v{version}.json"
            if history_file.exists():
                try:
                    with open(history_file, 'r', encoding='utf-8') as f:
                        return json.load(f)
                except Exception as e:
                    logger.error(f"Error loading version {version} for {model_name}: {e}")
        
        # Mevcut versiyon mu?
        current = self._load_prompt_file(model_name)
        if current and current.get("version") == version:
            return current
        
        return None
    
    def delete_version(self, model_name: str, version: int) -> bool:
        """Belirli bir versiyonu sil (mevcut versiyon silinemez)"""
        # Mevcut versiyonu kontrol et
        current = self._load_prompt_file(model_name)
        if current and current.get("version") == version:
            logger.warning(f"Cannot delete current version {version} for {model_name}")
            return False
        
        # History'den sil
        history_path = self.storage_path / "history"
        if history_path.exists():
            history_file = history_path / f"{model_name}_v{version}.json"
            if history_file.exists():
                try:
                    history_file.unlink()
                    logger.info(f"Deleted version {version} for {model_name}")
                    return True
                except Exception as e:
                    logger.error(f"Error deleting version {version} for {model_name}: {e}")
                    return False
        
        return False
    
    def _determine_schema_version(self, prompt_version: int) -> str:
        """
        Prompt versiyonuna göre schema versiyonunu belirler
        v1-v22: Eski flat schema (vkn, company_name, line_items)
        v23+: Yeni nested schema (metadata, document, items)
        """
        if prompt_version < 23:
            return "v1"  # Eski flat schema
        else:
            return "v2"  # Yeni nested schema
    
    def count_tokens(self, text: str) -> int:
        """
        Verilen metin için token sayısını hesaplar
        
        Args:
            text: Token sayısı hesaplanacak metin
            
        Returns:
            Token sayısı
        """
        try:
            return len(self.encoding.encode(text))
        except Exception as e:
            logger.error(f"Token counting error: {e}")
            # Fallback: kelime sayısı * 1.3 (ortalama)
            return int(len(text.split()) * 1.3)
    
    def get_available_versions(self, model_name: str) -> List[int]:
        """
        Belirtilen model için mevcut prompt versiyonlarını listele
        
        Args:
            model_name: Model adı (paddle_ocr, openai_vision, google_docai, amazon_textract)
            
        Returns:
            Mevcut versiyon numaraları listesi (artan sırada)
        """
        versions = []
        
        # Ana prompt dosyasından güncel versiyonu al
        main_file = self.storage_path / f"{model_name}.json"
        if main_file.exists():
            try:
                with open(main_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    current_version = data.get("version", 1)
                    versions.append(current_version)
            except Exception as e:
                logger.error(f"Error reading main prompt file for {model_name}: {e}")
        
        # History klasöründen diğer versiyonları al (utility fonksiyon kullanarak)
        history_dir = self.storage_path / "history"
        history_data = self._load_json_files(
            pattern=f"{model_name}_v*.json",
            directory=history_dir
        )
        
        for data in history_data:
            version = data.get("version")
            if version and version not in versions:
                versions.append(version)
        
        # Sırala ve döndür
        versions.sort()
        
        # Eğer hiç versiyon bulunamazsa, 1 döndür (default)
        if not versions:
            logger.warning(f"No versions found for {model_name}, returning [1]")
            versions = [1]
        
        return versions
