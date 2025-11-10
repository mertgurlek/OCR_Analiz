from typing import Dict, Any, Optional
from .base import BaseOCRService
from openai import AsyncOpenAI
import base64
import json
import logging
from .prompt_manager import PromptManager


logger = logging.getLogger(__name__)


class OpenAIVisionService(BaseOCRService):
    """OpenAI Vision API servisi"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.model_name = "openai_vision"
        
        # Fiyatlandırma: GPT-4 Vision
        # Input: $0.01 per 1K tokens
        # Image: $0.00765 per image (1024x1024)
        self.pricing = {
            "per_page": 0.00765,  # Base image cost
            "per_1k_tokens": 0.01
        }
        
        # Client oluştur
        api_key = config.get("api_key")
        if not api_key:
            raise ValueError("OpenAI API key gerekli")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = config.get("model", "gpt-4o")  # gpt-4o daha hızlı ve ucuz
        
        # Prompt Manager
        self.prompt_manager = PromptManager()
    
    async def process_image(
        self,
        image_bytes: bytes,
        prompt: Optional[str] = None,
        prompt_version: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        OpenAI Vision ile görseli işle
        
        Args:
            image_bytes: Görsel verisi
            prompt: Custom prompt (varsa kullanılır)
            prompt_version: Prompt versiyonu (None ise güncel versiyon)
            
        Returns:
            OCR sonucu
        """
        try:
            # Görseli base64'e çevir
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            
            # Prompt al (önce custom, yoksa prompt manager'dan)
            if not prompt:
                prompt_data = self.prompt_manager.get_prompt(
                    model_name=self.model_name,
                    version=prompt_version
                )
                prompt = prompt_data.get("prompt", "")
                used_version = prompt_data.get("version")
                logger.info(f"🤖 Using OpenAI Vision prompt v{used_version}")
            
            # Fallback: Eğer hala prompt yoksa, basit bir prompt kullan
            if not prompt:
                prompt = """Sen bir Türk muhasebe ve OCR uzmanısın. Bu fiş/fatura görselinden EKSIKSIZ ve DOĞRU bilgi çıkaracaksın.

🎯 GÖREV:
Bu görseldeki TÜM metni satır satır, kelime kelime, HARFI HARFINE oku ve çıkar.

📋 ÇIKARILACAK BİLGİLER:
1. **Ham Metin**: Görseldeki TÜM metin (yukarıdan aşağıya, soldan sağa, AYNEN)
2. **Yapısal Bilgiler**: 
   - Firma/işletme adı
   - VKN (10 haneli vergi kimlik numarası)
   - Adres
   - Tarih (DD/MM/YYYY formatında)
   - Fiş/Fatura numarası
   - Plaka (varsa)
3. **Ürün/Hizmetler**: Her bir kalem için:
   - Ürün/hizmet adı
   - Miktar ve birim
   - Birim fiyat
   - Toplam fiyat
   - KDV oranı
4. **Tutarlar**:
   - Ara toplam (KDV hariç)
   - KDV tutarı (oran bazında ayrı ayrı)
   - Genel toplam (KDV dahil)
   - Ödeme yöntemi

⚠️ KRİTİK KURALLAR:
- Türkçe karakterleri DOĞRU oku (ş, ğ, ı, ü, ö, ç, İ)
- Sayıları DOĞRU oku (0 ile O'yu, 1 ile I'yı, 5 ile S'yi karıştırma)
- Virgül ve noktayı DOĞRU ayırt et (123.45 ≠ 12345)
- Metinde görünen HER BİLGİYİ çıkar (atlama yapma)
- Belirsiz değilsen tahmin etme, tam emin ol

📤 ÇIKTI FORMATI (JSON):
{
  "raw_text": "TÜM METİN BURAYA (satır satır, aynen)",
  "structured": {
    "company_name": "...",
    "vkn": "...",
    "address": "...",
    "date": "DD/MM/YYYY",
    "receipt_number": "...",
    "plate": "...",
    "items": [
      {
        "name": "Ürün adı",
        "quantity": 0.0,
        "unit": "Lt/Kg/Adet/vb",
        "unit_price": 0.0,
        "total_price": 0.0,
        "vat_rate": 10
      }
    ],
    "subtotal": 0.0,
    "vat_breakdown": [
      {"rate": 10, "amount": 0.0}
    ],
    "total_vat": 0.0,
    "grand_total": 0.0,
    "payment_method": "NAKİT/KREDİ KARTI/vb"
  }
}

🔍 ÖZEL DİKKAT:
- VKN: 10 haneli sayı ara
- Tarih: DD/MM/YYYY veya DD.MM.YYYY formatında ara
- KDV oranları: %1, %8, %10, %18, %20
- Toplam: Genelde fişin en altında, büyük puntolu
- Plaka: 34ABC123 gibi format

✅ ŞİMDİ ANALİZ ET VE JSON DÖNDÜR!"""
            
            # API çağrısı
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{base64_image}",
                                    "detail": "high"  # Yüksek detay için (kritik!)
                                }
                            }
                        ]
                    }
                ],
                max_tokens=3000,  # Büyük fişler için yeterli
                temperature=0.0,  # Tam deterministik sonuçlar
                top_p=1.0,  # Determinizm için
                frequency_penalty=0.0,  # Tekrar eden kelimeler/sayılar için önemli
                presence_penalty=0.0  # Yeni token cezası yok
            )
            
            # Response parse et
            content = response.choices[0].message.content
            
            # JSON parse etmeye çalış
            structured_data = None
            text = content
            
            try:
                # JSON bulma ve temizleme
                json_str = content.strip()
                
                # Markdown code block varsa temizle
                if "```json" in json_str:
                    json_str = json_str.split("```json")[1].split("```")[0].strip()
                elif "```" in json_str:
                    json_str = json_str.split("```")[1].split("```")[0].strip()
                
                # JSON parse et
                parsed = json.loads(json_str)
                
                # V2 Schema formatı kontrolü
                if isinstance(parsed, dict):
                    # Yeni V2 format (metadata, document, items, totals)
                    if all(key in parsed for key in ["metadata", "document", "items", "totals"]):
                        structured_data = parsed
                        logger.info("✅ V2 schema detected")
                    # Eski V1 format (raw_text, structured)
                    elif "raw_text" in parsed and "structured" in parsed:
                        text = parsed["raw_text"]
                        structured_data = parsed["structured"]
                        logger.info("✅ V1 schema detected (legacy)")
                    # Direkt structured data
                    else:
                        structured_data = parsed
                        logger.info("✅ Direct JSON structure")
                    
            except json.JSONDecodeError as e:
                # JSON parse edilemezse, content'i text olarak kullan
                logger.warning(f"⚠️ JSON parse error: {str(e)}")
                text = content
                structured_data = None
            
            # Token usage
            token_count = response.usage.total_tokens
            
            return {
                "text": text,
                "structured_data": structured_data,
                "confidence": 0.95,  # OpenAI confidence vermiyor, sabit değer
                "token_count": token_count,
                "metadata": {
                    "model": response.model,
                    "page_count": 1,  # Her çağrı 1 görsel işliyor
                    "finish_reason": response.choices[0].finish_reason,
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens
                },
                "raw_response": {
                    "content": content[:500]  # İlk 500 karakter
                }
            }
            
        except Exception as e:
            raise Exception(f"OpenAI Vision hatası: {str(e)}")
