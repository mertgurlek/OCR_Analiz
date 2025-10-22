"""
OCR sonuçlarını GPT ile yapılandırılmış muhasebe verisine dönüştürür
"""

import json
import time
import logging
from typing import Dict, Any, List, Optional
from openai import AsyncOpenAI
from ..models.schemas import AccountingData, LineItem, VATBreakdown
from .prompt_manager import PromptManager
from .schema_registry import get_schema_registry
from .model_specific_parsers import get_model_parser

logger = logging.getLogger(__name__)


class AccountingService:
    """GPT kullanarak muhasebe verisi çıkarma servisi"""
    
    # Model fiyatlandırması (USD per 1M tokens)
    MODEL_PRICING = {
        "gpt-4o-mini": {
            "input": 0.15,   # $0.15 / 1M input tokens
            "output": 0.60   # $0.60 / 1M output tokens
        },
        "gpt-4.1-mini": {
            "input": 0.10,   # $0.10 / 1M input tokens (varsayılan, gerçek fiyat kontrol edilmeli)
            "output": 0.40   # $0.40 / 1M output tokens (varsayılan, gerçek fiyat kontrol edilmeli)
        }
    }
    
    def __init__(self, api_key: str, gpt_model: str = "gpt-4o-mini"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = gpt_model  # Seçilebilir GPT modeli
        self.temperature = 0.1  # Minimal randomness (OCR hata toleransı için)
        # NOT: 0.0 = Tam deterministik, 0.1 = Hafif esneklik
        # Muhasebe için 0.1'den yüksek ÖNERİLMEZ!
        self.max_tokens = 3000  # Büyük fişler için yeterli
        self.prompt_manager = PromptManager()  # Prompt yöneticisi
        
    async def extract_accounting_data_per_model(
        self,
        ocr_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Her bir OCR modeli için ayrı ayrı muhasebe verisi çıkar (PARALEL)
        
        Args:
            ocr_results: Farklı modellerden gelen OCR sonuçları
            
        Returns:
            List of results for each model
        """
        import asyncio
        
        # Paralel işlenecek taskler
        tasks = []
        
        for ocr_result in ocr_results:
            model_name = ocr_result.get("model_name", "Unknown")
            text_content = ocr_result.get("text_content", "")
            entities = ocr_result.get("entities")
            structured_data = ocr_result.get("structured_data")
            error = ocr_result.get("error")
            
            # Eğer OCR'da hata varsa veya metin yoksa, boş result döndüren coroutine oluştur
            if error or not text_content or text_content.strip() == "":
                # Closure variable capture için lambda kullan
                async def _create_empty_result(name=model_name, err=error):
                    return {
                        "model_name": name,
                        "accounting_data": {
                            "line_items": [],
                            "vat_breakdown": []
                        },  # Boş V1 format
                        "raw_gpt_response": None,
                        "processing_time_ms": 0,
                        "estimated_cost": 0.0,
                        "error": err or "OCR metni bulunamadı"
                    }
                tasks.append(_create_empty_result())
            else:
                # Bu model için muhasebe verisi çıkar (entities dahil) - paralel
                tasks.append(self._extract_for_single_model(model_name, text_content, entities, structured_data))
        
        # Tüm modelleri PARALEL işle (60 saniye yerine ~15 saniyede biter!)
        logger.info(f"🚀 Processing {len(tasks)} models in PARALLEL...")
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Exception'ları yakala ve error olarak döndür
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"❌ Model {i} failed: {result}")
                final_results.append({
                    "model_name": ocr_results[i].get("model_name", "Unknown"),
                    "accounting_data": {"line_items": [], "vat_breakdown": []},
                    "raw_gpt_response": None,
                    "processing_time_ms": 0,
                    "estimated_cost": 0.0,
                    "error": str(result)
                })
            else:
                final_results.append(result)
        
        return final_results
    
    async def _extract_for_single_model(
        self,
        model_name: str,
        text_content: str,
        entities: Optional[List[Dict]] = None,
        structured_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Tek bir model için muhasebe verisi çıkar
        
        Args:
            model_name: Model adı
            text_content: OCR metni
            
        Returns:
            Dict containing accounting data for this model
        """
        start_time = time.time()
        
        # GPT'ye gönderilecek prompt (entities ve structured_data dahil)
        prompt = self._create_accounting_prompt_single(model_name, text_content, entities, structured_data)
        
        # DEBUG: Hangi prompt kullanıldığını logla
        logger.info(f"🎯 Creating prompt for model: {model_name}")
        logger.debug(f"   Prompt preview (first 100 chars): {prompt[:100]}")
        
        try:
            # GPT API çağrısı (structured output)
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": f"""Sen elit seviye bir Türk muhasebe ve finansal analiz uzmanısın.

🎯 UZMANLIKLARIN:
- Fiş/Fatura OCR çıktılarını analiz etme
- Yapılandırılmış muhasebe verisi çıkarma
- KDV hesaplamaları ve vergi mevzuatı
- Hata düzeltme ve veri doğrulama
- Akıllı veri yorumlama

📋 GÖREVİN:
1. **OCR Metni Analizi**: OCR çıktısını dikkatlice oku (kaynak: {model_name})
2. **Veri Çıkarımı**: Tüm kritik bilgileri çıkar (VKN, firma, tarih, ürünler, tutarlar)
3. **KDV Ayrıştırma**: Her KDV oranı için (0%, 1%, 10%, 20%) ayrı breakdown oluştur
4. **Doğrulama**: Matematiksel tutarlılık kontrol et
5. **JSON Dönüşümü**: Belirtilen şemaya uygun JSON döndür

⚠️ KRİTİK KURALLAR:
- Sayısal değerler MUTLAKA number tipinde ("123.45" YANLIŞ, 123.45 DOĞRU)
- Bulunamayan veya şüpheli değerler için null kullan (boş string "" YASAK)
- Tüm tutarlar TL cinsinden decimal olmalı
- JSON şemasına TAM UYUM (eksik veya fazla field YASAK)

🧮 MATEMATİK KONTROL:
- Hedef: grand_total = subtotal + total_vat
- Her line_item: total_price = unit_price * quantity
- OCR kalitesi düşükse, fişte basılı toplam tutara öncelik ver
- Tutarsızlık varsa, en güvenilir değeri kullan (genelde fiş altındaki toplam)
- vat_breakdown toplamı ~= total_vat olmalı (küçük yuvarlama farkları kabul edilebilir)

🎯 MODEL-SPECIFIC TALİMATLAR ÖNCELİKLİDİR:
Aşağıdaki user mesajında bu OCR modeline özel talimatlar var.
O talimatlara MUTLAKA uy - bu genel kurallardan daha ÖNCELİKLİDİR.
Her OCR modelinin farklı güçlü/zayıf yönleri var, buna göre uyarla.

🎓 KALİTE STANDARDI:
Senin çıktın muhasebe analizine gidecek. Mümkün olan en yüksek doğruluk ve tutarlılık gerekli."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=self.temperature,  # Tam deterministik
                max_tokens=self.max_tokens,  # Büyük fişler için
                top_p=1.0,  # Determinizm için
                frequency_penalty=0.0,  # Tekrarlara izin ver (sayılar için önemli)
                presence_penalty=0.0  # Yeni token cezası yok
            )
            
            # Yanıtı parse et
            raw_response = response.choices[0].message.content
            
            # JSON'u temizle (markdown code blocks vb.)
            cleaned_json = self._clean_json_response(raw_response)
            
            try:
                parsed_data = json.loads(cleaned_json)
            except json.JSONDecodeError as e:
                logger.error(f"❌ JSON parse error: {e}")
                logger.error(f"📝 Raw response (first 500 chars): {raw_response[:500]}")
                raise Exception(f"GPT invalid JSON döndürdü: {str(e)}")
            
            # Model-specific parser ile dönüştür
            prompt_data = self.prompt_manager.get_prompt(model_name)
            prompt_version = prompt_data.get("version", 1)
            schema_version = prompt_data.get("schema_version", "v1")
            
            logger.info(f"📦 Model: {model_name}, Prompt v{prompt_version}, Schema: {schema_version}")
            
            # Model-specific parser kullan
            model_parser = get_model_parser(model_name)
            normalized_data = model_parser.parse(parsed_data, prompt_version)
            
            # Parse sonrası kontrol
            logger.info(f"✅ Schema parsed: {len(normalized_data.get('items', []))} items, "
                       f"totals: {normalized_data.get('totals', {}).get('totalAmount')}")
            logger.debug(f"   Document: {normalized_data.get('document', {}).get('merchantName')}")
            
            # 2. VEYA otomatik tespit (fallback)
            # normalized_data = registry.parse_with_auto_detection(parsed_data)
            
            # AccountingData modeline çevir
            accounting_data = self._parse_to_accounting_data(normalized_data)
            
            # ⚡ CRITICAL: Frontend V1 formatı bekliyor, V2'yi V1'e çevir
            accounting_data_v1 = self._convert_v2_to_v1_format(accounting_data)
            
            # Maliyet hesapla
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            cost = self._calculate_cost(input_tokens, output_tokens)
            
            processing_time = (time.time() - start_time) * 1000
            
            return {
                "model_name": model_name,
                "accounting_data": accounting_data_v1,  # ← V1 format (dict)
                "raw_gpt_response": raw_response,
                "processing_time_ms": processing_time,
                "estimated_cost": cost,
                "token_usage": {
                    "input": input_tokens,
                    "output": output_tokens,
                    "total": input_tokens + output_tokens
                }
            }
            
        except Exception as e:
            processing_time = (time.time() - start_time) * 1000
            
            logger.error(f"❌ Accounting extraction error for {model_name}: {str(e)}")
            
            # Hata durumunda boş V1 format dict dön
            return {
                "model_name": model_name,
                "accounting_data": {
                    "line_items": [],
                    "vat_breakdown": []
                },  # Boş V1 format
                "raw_gpt_response": None,
                "processing_time_ms": processing_time,
                "estimated_cost": 0.0,
                "error": str(e)
            }
    
    def _create_accounting_prompt_single(
        self, 
        model_name: str, 
        ocr_text: str,
        entities: Optional[List[Dict]] = None,
        structured_data: Optional[Dict] = None
    ) -> str:
        """Muhasebe analizi için prompt oluştur - Model bazında özelleştirilmiş"""
        
        # PromptManager'dan model bazında özel prompt'u al
        prompt_data = self.prompt_manager.get_prompt(model_name)
        model_specific_instructions = prompt_data.get("prompt", "")
        
        # OCR metninin uzunluğunu kontrol et
        text_preview = ocr_text[:500] if len(ocr_text) > 500 else ocr_text
        text_info = f"(İlk 500 karakter gösteriliyor)" if len(ocr_text) > 500 else ""
        
        # Entities bilgisini hazırla (Google DocAI için)
        entities_section = ""
        if entities and len(entities) > 0:
            entities_json = json.dumps(entities, ensure_ascii=False, indent=2)
            entities_section = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ÇIKARILMIŞ ENTİTİLER (Google DocAI Otomatik Algılama)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{entities_json}

⚡ BU BİLGİYİ KULLAN: Google DocAI bu değerleri otomatik tespit etti. 
Tarih, tutar, firma adı gibi bilgiler için öncelikle bunlara bak!
"""
        
        return f"""📄 FİŞ ANALİZİ GÖREVİ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 OCR KAYNAK: {model_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{model_specific_instructions}

{entities_section}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 OCR METNİ {text_info}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{ocr_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ZORUNLU JSON ŞEMASI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "metadata": {{
    "source": "string",                    // OCR model adı
    "ocrQualityScore": number,            // 0.0-1.0
    "classification": "string",           // grocery, fuel, restaurant, etc.
    "vatTreatment": "string",             // "VAT included" veya "VAT excluded"
    "notes": "string"
  }},
  
  "document": {{
    "merchantName": "string | null",      // Firma adı
    "merchantVKN": "string | null",       // 10 haneli VKN
    "merchantTCKN": "string | null",      // 11 haneli TCKN
    "address": "string | null",
    "date": "string | null",              // DD.MM.YYYY
    "time": "string | null",              // HH:MM
    "receiptNo": "string | null",
    "plate": "string | null",
    "invoiceNo": "string | null",
    "mersisNo": "string | null"
  }},
  
  "items": [                              // ✅ "line_items" DEĞİL "items"
    {{
      "description": "string",           // ✅ "name" DEĞİL "description"
      "quantity": number,
      "unitPrice": number,                // ✅ camelCase
      "grossAmount": number,              // ✅ KDV dahil tutar
      "netAmount": number,                // ✅ KDV hariç tutar
      "vatRate": integer,                 // ✅ 0, 1, 10, 20
      "vatAmount": number,
      "discountAmount": number,
      "accountCode": "string",
      "itemType": "string",               // food, drink, fuel, etc.
      "confidence": number                // 0.0-1.0
    }}
  ],
  
  "extraTaxes": [                         // Ek vergiler (konaklama vergisi gibi)
    {{
      "type": "string",
      "amount": number
    }}
  ],
  
  "totals": {{
    "vatBreakdown": [                     // KDV dağılımı
      {{
        "vatRate": integer,               // ✅ "rate" DEĞİL "vatRate"
        "taxBase": number,                // ✅ "base_amount" DEĞİL "taxBase"
        "vatAmount": number
      }}
    ],
    "totalVat": number,
    "totalAmount": number,                // Genel toplam
    "paymentAccountCode": "string",
    "currency": "TRY"
  }},
  
  "paymentLines": [                       // Ödeme satırları
    {{
      "method": "string",                 // cash, credit_card, bank_transfer
      "amount": number,
      "accountCode": "string"             // 100, 108, 102
    }}
  ],
  
  "entryLines": [                         // Muhasebe yevmiye kayıtları
    {{
      "accountCode": "string",
      "debit": number,
      "credit": number,
      "description": "string"
    }}
  ],
  
  "unprocessedLines": ["string"],       // İşlenemeyen OCR satırları
  "validationFlags": ["string"],         // Uyarılar (ROUNDING_APPLIED, etc.)
  "errorFlags": ["string"],              // Hatalar (TOTAL_MISMATCH, etc.)
  
  "stats": {{
    "itemCount": integer,
    "parsedLines": integer,
    "unprocessedCount": integer
  }}
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ KRİTİK KURALLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🔢 TİP KURALLARI:
   ✅ Sayılar: number (123.45) ← DOĞRU
   ❌ Sayılar: string ("123.45") ← YANLIŞ
   ✅ Bulunamayan: null ← DOĞRU
   ❌ Bulunamayan: "" veya "N/A" ← YANLIŞ

2. 📊 ARRAY KURALLARI:
   ✅ line_items: [] ← Boş array DOĞRU
   ❌ line_items: null ← YANLIŞ
   ✅ vat_breakdown: [] ← Boş array DOĞRU
   ❌ vat_breakdown: null ← YANLIŞ

3. 🧮 MATEMATİK KURALLARI:
   - grand_total ≈ subtotal + total_vat (±0.01 TL hata payı)
   - line_items toplamı ≈ grand_total (±0.01 TL hata payı)
   - Her line_item: total_price ≈ unit_price × quantity
   - Her line_item: vat_amount ≈ total_price × (vat_rate / (100 + vat_rate))
   
   💡 İNDİRİM HESAPLAMA:
   - Eğer (unit_price × quantity) > grossAmount ise:
     discountAmount = (unit_price × quantity) - grossAmount
   - Örnek: Birim fiyat ₺1199.99, Miktar 1, Toplam ₺839.99
     → discountAmount = 1199.99 - 839.99 = 360.00
   - İndirim yoksa: discountAmount = 0.0

4. 📅 FORMAT KURALLARI:
   ✅ Tarih: "14/09/2023" (DD/MM/YYYY)
   ❌ Tarih: "2023-09-14" veya "14.09.2023"
   ✅ VKN: "1234567890" (10 haneli, boşluksuz)
   ❌ VKN: "123 456 7890" veya "123-456-7890"

5. 🎯 KDV ORANLARI (Türkiye):
   - %1: İhraç kayıtlı teslimlerde
   - %8: Temel gıda, kitap, gazete
   - %10: Akaryakıt, doğalgaz, elektrik
   - %18: Genel oran (2018 öncesi)
   - %20: Genel oran (2018 sonrası, güncel)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ÖRNEK ÇIKTI (Referans)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "metadata": {{
    "source": "paddle_ocr",
    "ocrQualityScore": 0.85,
    "classification": "fuel_station",
    "vatTreatment": "VAT included",
    "notes": ""
  }},
  "document": {{
    "merchantName": "ABC Petrol A.Ş.",
    "merchantVKN": "1234567890",
    "merchantTCKN": null,
    "address": "İstanbul Cad. No:15",
    "date": "14.09.2023",
    "time": "15:30",
    "receiptNo": "FIS-0040",
    "plate": "34ABC123",
    "invoiceNo": null,
    "mersisNo": null
  }},
  "items": [
    {{
      "description": "Motorin",
      "quantity": 50.5,
      "unitPrice": 34.50,
      "grossAmount": 1742.25,
      "netAmount": 1583.84,
      "vatRate": 10,
      "vatAmount": 158.41,
      "discountAmount": 0.0,
      "accountCode": "153",
      "itemType": "fuel",
      "confidence": 0.95
    }},
    {{
      "description": "Kısa kol gömlek",
      "quantity": 1.0,
      "unitPrice": 1199.99,
      "grossAmount": 839.99,
      "netAmount": 763.63,
      "vatRate": 10,
      "vatAmount": 76.36,
      "discountAmount": 360.0,
      "accountCode": "153",
      "itemType": "clothing",
      "confidence": 0.90
    }},
    {{
      "description": "Yıkama Hizmeti",
      "quantity": 1.0,
      "unitPrice": 100.0,
      "grossAmount": 100.0,
      "netAmount": 83.33,
      "vatRate": 20,
      "vatAmount": 16.67,
      "discountAmount": 0.0,
      "accountCode": "770",
      "itemType": "service",
      "confidence": 0.90
    }}
  ],
  "extraTaxes": [],
  "totals": {{
    "vatBreakdown": [
      {{
        "vatRate": 10,
        "taxBase": 2347.47,
        "vatAmount": 234.77
      }},
      {{
        "vatRate": 20,
        "taxBase": 83.33,
        "vatAmount": 16.67
      }}
    ],
    "totalVat": 251.44,
    "totalAmount": 2682.24,
    "paymentAccountCode": "108",
    "currency": "TRY"
  }},
  "paymentLines": [
    {{
      "method": "credit_card",
      "amount": 2682.24,
      "accountCode": "108"
    }}
  ],
  "entryLines": [
    {{
      "accountCode": "153",
      "debit": 1583.84,
      "credit": 0.0,
      "description": "Motorin alışı"
    }},
    {{
      "accountCode": "153",
      "debit": 763.63,
      "credit": 0.0,
      "description": "Gömlek alışı (İndirimli)"
    }},
    {{
      "accountCode": "191",
      "debit": 234.77,
      "credit": 0.0,
      "description": "İndirilecek KDV %10"
    }},
    {{
      "accountCode": "770",
      "debit": 83.33,
      "credit": 0.0,
      "description": "Yıkama hizmeti"
    }},
    {{
      "accountCode": "191",
      "debit": 16.67,
      "credit": 0.0,
      "description": "İndirilecek KDV %20"
    }},
    {{
      "accountCode": "108",
      "debit": 0.0,
      "credit": 2682.24,
      "description": "Kredi kartı ile ödeme"
    }}
  ],
  "unprocessedLines": [],
  "validationFlags": [],
  "errorFlags": [],
  "stats": {{
    "itemCount": 3,
    "parsedLines": 15,
    "unprocessedCount": 0
  }}
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 GÖREV: ŞİMDİ ANALİZ ET!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Yukarıdaki OCR metnini analiz et ve SADECE JSON çıktı ver.
❌ Ekstra açıklama YAPMA
❌ Markdown kod bloğu KULLANMA (```json yok!)
✅ Sadece saf JSON döndür ({{ ile başla, }} ile bitir)
✅ Matematik kontrolü yap, tutarlılığı garanti et"""
    
    def _parse_list_items(self, data: Dict[str, Any], key: str, model_class, item_name: str = "item") -> List:
        """
        Generic Pydantic list parser - tekrarlayan try-catch bloklarını ortadan kaldırır
        
        Args:
            data: Source data dictionary
            key: Dictionary key for the list (örn: "items", "extraTaxes")
            model_class: Pydantic model class
            item_name: Item name for logging (örn: "item", "tax", "payment")
            
        Returns:
            Parsed Pydantic model listesi
        """
        result = []
        for idx, item in enumerate(data.get(key, [])):
            try:
                result.append(model_class(**item))
            except Exception as e:
                logger.warning(f"⚠️ {item_name.capitalize()} #{idx+1} parse error: {e}")
                logger.debug(f"   Problematic {item_name} data: {item}")
                continue
        return result
    
    def _parse_to_accounting_data(self, data: Dict[str, Any]) -> AccountingData:
        """
        Normalized V2 data'yı AccountingData modeline çevir
        
        NOT: Bu metoda gelen data, schema_registry tarafından zaten
        V2 formatına dönüştürülmüştür. Dolayısıyla her zaman standart
        V2 nested yapısını bekler.
        """
        from ..models.schemas import (
            MetadataInfo, DocumentInfo, LineItem, ExtraTax, 
            TotalsInfo, VATBreakdown, PaymentLine, EntryLine, StatsInfo
        )
        
        logger.debug(f"🔧 Parsing normalized V2 data: {len(data.get('items', []))} items")
        
        # Metadata
        metadata = None
        if "metadata" in data:
            try:
                metadata = MetadataInfo(**data["metadata"])
            except Exception as e:
                logger.warning(f"⚠️ Metadata parse error: {e}")
        
        # Document info
        document = None
        if "document" in data:
            try:
                document = DocumentInfo(**data["document"])
            except Exception as e:
                logger.warning(f"⚠️ Document parse error: {e}")
        
        # Items (generic parser kullanarak)
        items = self._parse_list_items(data, "items", LineItem, "item")
        
        # Extra taxes (generic parser kullanarak)
        extra_taxes = self._parse_list_items(data, "extraTaxes", ExtraTax, "tax")
        
        # Totals
        totals = None
        if "totals" in data:
            try:
                totals = TotalsInfo(**data["totals"])
            except Exception as e:
                logger.warning(f"⚠️ Totals parse error: {e}")
        
        # Payment lines (generic parser kullanarak)
        payment_lines = self._parse_list_items(data, "paymentLines", PaymentLine, "payment")
        
        # Entry lines (generic parser kullanarak)
        entry_lines = self._parse_list_items(data, "entryLines", EntryLine, "entry")
        
        # Stats
        stats = None
        if "stats" in data:
            try:
                stats = StatsInfo(**data["stats"])
            except Exception as e:
                logger.warning(f"⚠️ Stats parse error: {e}")
        
        logger.debug(f"✅ Parsed successfully: {len(items)} items, {len(payment_lines)} payments")
        
        return AccountingData(
            metadata=metadata,
            document=document,
            items=items,
            extra_taxes=extra_taxes,
            totals=totals,
            payment_lines=payment_lines,
            entry_lines=entry_lines,
            unprocessed_lines=data.get("unprocessedLines", []),
            validation_flags=data.get("validationFlags", []),
            error_flags=data.get("errorFlags", []),
            stats=stats
        )
    
    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Seçili GPT modelinin maliyetini hesapla
        Model bazlı fiyatlandırma kullanır
        """
        pricing = self.MODEL_PRICING.get(self.model, self.MODEL_PRICING["gpt-4o-mini"])
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return input_cost + output_cost
    
    def _calculate_vat_from_items(self, line_items: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], Dict[str, float]]:
        """
        Ürün/hizmet kalemlerinden KDV dökümünü hesaplar
        Her KDV oranı için toplamları hesaplar
        
        DOĞRU YÖNTEM: Önce aynı KDV oranlı ürünlerin tutarlarını topla, 
        SONRA tek seferde KDV hesapla (yuvarlama kayıplarını önler)
        
        Args:
            line_items: Ürün/hizmet kalemleri listesi
            
        Returns:
            tuple: (KDV dökümü, Toplamlar dict)
                - KDV dökümü: [{rate, base_amount, vat_amount, total_amount}, ...]
                - Toplamlar: {subtotal, total_vat, grand_total}
        """
        from collections import defaultdict
        
        logger.debug(f"💰 Calculating VAT from {len(line_items)} line items")
        
        # KDV oranına göre grupla - ÖNCE TOPLA
        vat_groups = defaultdict(lambda: {"total_gross": 0.0})
        
        for item in line_items:
            vat_rate = item.get("vat_rate", 0)
            if vat_rate is None:
                vat_rate = 0
            
            # Önce GPT'nin verdiği total_price'ı al
            total_price = item.get("total_price", 0) or 0
            discount_amount = item.get("discount_amount", 0) or 0
            
            # İndirim varsa doğrulama yap ve gerekirse düzelt
            if discount_amount > 0:
                unit_price = item.get("unit_price", 0) or 0
                quantity = item.get("quantity", 1) or 1
                
                gross_before_discount = unit_price * quantity
                expected_total = gross_before_discount - discount_amount
                
                # Eğer total_price, indirim öncesi tutara eşitse → indirim uygulanmamış, uygula!
                if abs(total_price - gross_before_discount) < 0.01:
                    logger.debug(f"🔖 İndirim uygulanıyor: {gross_before_discount:.2f} - {discount_amount:.2f} = {expected_total:.2f}")
                    total_price = expected_total
                # Eğer total_price, beklenen indirimli tutara eşitse → zaten doğru
                elif abs(total_price - expected_total) < 0.01:
                    logger.debug(f"✅ İndirim zaten uygulanmış: {total_price:.2f}")
                # Eğer ikisi de tutmuyorsa → GPT'nin dediğini kullan ama uyar
                else:
                    logger.warning(f"⚠️ İndirim tutarsızlığı: expected={expected_total:.2f}, got={total_price:.2f} - GPT değeri kullanılıyor")
            
            # Brüt tutarları topla (KDV dahil, indirim sonrası)
            vat_groups[vat_rate]["total_gross"] += total_price
        
        # SONRA her grup için tek seferde KDV hesapla (yuvarlama kaybı önlenir)
        calculated_breakdown = []
        total_vat_sum = 0.0
        total_grand_sum = 0.0
        
        for rate in sorted(vat_groups.keys()):
            gross_total = vat_groups[rate]["total_gross"]
            
            if rate > 0:
                # KDV dahil fiyattan KDV'yi çıkar
                # Formül: vat_amount = gross / (100 + rate) × rate
                vat_amount = (gross_total / (100 + rate)) * rate
                base_amount = gross_total - vat_amount
            else:
                # %0 KDV
                vat_amount = 0.0
                base_amount = gross_total
            
            calculated_breakdown.append({
                "rate": rate,
                "base_amount": round(base_amount, 2),
                "vat_amount": round(vat_amount, 2),
                "total_amount": round(gross_total, 2)
            })
            
            # Toplamları hesapla (tek seferde, tekrar sum() yapmaya gerek yok)
            total_vat_sum += vat_amount
            total_grand_sum += gross_total
            
            logger.debug(f"📊 %{rate} KDV: gross={gross_total:.2f} → vat={vat_amount:.2f}, base={base_amount:.2f}")
        
        # Toplam değerleri hazırla
        totals = {
            "subtotal": round(total_grand_sum - total_vat_sum, 2),
            "total_vat": round(total_vat_sum, 2),
            "grand_total": round(total_grand_sum, 2)
        }
        
        logger.debug(f"✅ Calculated VAT breakdown for {len(calculated_breakdown)} rates")
        logger.debug(f"💰 Totals from breakdown: subtotal={totals['subtotal']}, vat={totals['total_vat']}, grand={totals['grand_total']}")
        
        return calculated_breakdown, totals
    
    def _convert_v2_to_v1_format(self, accounting_data: AccountingData) -> Dict[str, Any]:
        """
        V2 nested schema'yı V1 flat schema'ya çevirir (Frontend compatibility)
        
        Frontend hala eski V1 formatı bekliyor:
        - vkn, company_name, line_items, vat_breakdown (flat)
        
        Backend V2 üretiyor:
        - metadata, document, items, totals (nested)
        
        Bu metod geçici bir compatibility layer sağlar.
        """
        logger.debug("🔄 Converting V2 schema to V1 for frontend compatibility")
        
        v1_data = {}
        
        # Document bilgilerini flat yapıya taşı
        if accounting_data.document:
            v1_data["vkn"] = accounting_data.document.merchant_vkn
            v1_data["company_name"] = accounting_data.document.merchant_name
            v1_data["plate"] = accounting_data.document.plate
            v1_data["date"] = accounting_data.document.date
            v1_data["receipt_number"] = accounting_data.document.receipt_no
        
        # Items -> line_items dönüşümü
        line_items = []
        for item in accounting_data.items:
            line_item = {
                "name": item.description,  # ← "description" -> "name"
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.gross_amount,  # ← "grossAmount" -> "total_price"
                "vat_rate": item.vat_rate,
                "vat_amount": item.vat_amount,
                "discount_amount": item.discount_amount if item.discount_amount else 0.0  # ← İndirim bilgisi
            }
            line_items.append(line_item)
        v1_data["line_items"] = line_items
        
        # VAT breakdown dönüşümü - GPT'den gelen (original)
        vat_breakdown_gpt = []
        if accounting_data.totals and accounting_data.totals.vat_breakdown:
            for vat in accounting_data.totals.vat_breakdown:
                vat_item = {
                    "rate": vat.vat_rate,
                    "base_amount": vat.tax_base,
                    "vat_amount": vat.vat_amount,
                    "total_amount": vat.tax_base + vat.vat_amount  # Hesapla
                }
                vat_breakdown_gpt.append(vat_item)
        
        # VAT breakdown hesapla - Ürün kalemlerinden (calculated)
        # Artık hem dökümü hem toplamları döndürüyor (tek seferde, tekrar hesaplamaya gerek yok)
        vat_breakdown_calculated, totals_calculated = self._calculate_vat_from_items(line_items)
        
        # İki versiyonu da kaydet
        v1_data["vat_breakdown"] = vat_breakdown_gpt  # Geriye uyumluluk için
        v1_data["vat_breakdown_gpt"] = vat_breakdown_gpt  # GPT'den gelen
        v1_data["vat_breakdown_calculated"] = vat_breakdown_calculated  # Hesaplanan
        
        logger.debug(f"📊 VAT Breakdown: GPT={len(vat_breakdown_gpt)} rates, Calculated={len(vat_breakdown_calculated)} rates")
        
        # Totals - GPT'den gelen (geriye uyumluluk için de sakla)
        if accounting_data.totals:
            v1_data["total_vat"] = accounting_data.totals.total_vat
            v1_data["total_vat_gpt"] = accounting_data.totals.total_vat
            v1_data["grand_total"] = accounting_data.totals.total_amount
            v1_data["grand_total_gpt"] = accounting_data.totals.total_amount
            # Subtotal hesapla (grand_total - total_vat)
            if accounting_data.totals.total_amount and accounting_data.totals.total_vat:
                subtotal_gpt = accounting_data.totals.total_amount - accounting_data.totals.total_vat
                v1_data["subtotal"] = subtotal_gpt
                v1_data["subtotal_gpt"] = subtotal_gpt
        
        # Totals - Ürün kalemlerinden hesaplanan
        # NOT: _calculate_vat_from_items() içinde zaten hesaplandı, direkt kullan
        v1_data["subtotal_calculated"] = totals_calculated["subtotal"]
        v1_data["total_vat_calculated"] = totals_calculated["total_vat"]
        v1_data["grand_total_calculated"] = totals_calculated["grand_total"]
        
        logger.debug(f"💰 Totals - GPT: subtotal={v1_data.get('subtotal_gpt')}, vat={v1_data.get('total_vat_gpt')}, grand={v1_data.get('grand_total_gpt')}")
        logger.debug(f"💰 Totals - Calculated: subtotal={v1_data['subtotal_calculated']}, vat={v1_data['total_vat_calculated']}, grand={v1_data['grand_total_calculated']}")
        
        # Payment method (ilk payment line'dan al)
        if accounting_data.payment_lines and len(accounting_data.payment_lines) > 0:
            payment = accounting_data.payment_lines[0]
            v1_data["payment_method"] = payment.method
        
        logger.debug(f"✅ V2 -> V1 conversion complete: {len(line_items)} items")
        return v1_data
    
    def _clean_json_response(self, response: str) -> str:
        """
        GPT yanıtını temizleyerek saf JSON elde eder
        
        GPT bazen şunları döndürebilir:
        - ```json ... ``` (markdown code block)
        - Açıklama metni + JSON
        - Ekstra whitespace
        
        Bu metod bunları temizler.
        """
        import re
        
        # Markdown code block varsa temizle
        if "```json" in response:
            # ```json ve ``` arasındaki kısmı al
            match = re.search(r'```json\s*\n(.*?)\n```', response, re.DOTALL)
            if match:
                response = match.group(1)
        elif "```" in response:
            # Sadece ``` varsa (json prefix olmadan)
            match = re.search(r'```\s*\n(.*?)\n```', response, re.DOTALL)
            if match:
                response = match.group(1)
        
        # JSON'un başlangıcını bul ({ ile başlayan)
        start_idx = response.find('{')
        if start_idx == -1:
            logger.warning("⚠️ JSON başlangıcı bulunamadı, tüm response'u kullanıyorum")
            return response.strip()
        
        # JSON'un sonunu bul (son } karakteri)
        end_idx = response.rfind('}')
        if end_idx == -1:
            logger.warning("⚠️ JSON sonu bulunamadı, tüm response'u kullanıyorum")
            return response.strip()
        
        # Sadece JSON kısmını al
        cleaned = response[start_idx:end_idx+1]
        
        return cleaned.strip()
