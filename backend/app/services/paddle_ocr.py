from typing import Dict, Any, Optional
import logging
from .base import BaseOCRService
import aiohttp
import io

logger = logging.getLogger(__name__)


class PaddleOCRService(BaseOCRService):
    """PaddleOCR Mikroservis Client (Port 8001)"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.model_name = "paddle_ocr"
        
        # Fiyatlandırma: Ücretsiz (açık kaynak)
        self.pricing = {
            "per_page": 0.0,
            "per_1k_tokens": 0.0
        }
        
        # Mikroservis URL
        self.service_url = config.get("paddle_service_url", "http://localhost:8001")
        logger.info(f"PaddleOCR mikroservis URL: {self.service_url}")
    
    async def process_image(
        self,
        image_bytes: bytes,
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        PaddleOCR mikroservisine istek gönder
        
        Args:
            image_bytes: Görsel verisi
            prompt: Kullanılmıyor (PaddleOCR prompt desteklemiyor)
            
        Returns:
            OCR sonucu
        """
        try:
            logger.info("Sending request to PaddleOCR microservice...")
            
            # Mikroservise HTTP POST isteği
            async with aiohttp.ClientSession() as session:
                # Multipart form data oluştur
                form = aiohttp.FormData()
                form.add_field(
                    'file',
                    io.BytesIO(image_bytes),
                    filename='image.jpg',
                    content_type='image/jpeg'
                )
                
                # İstek gönder
                async with session.post(
                    f"{self.service_url}/ocr/process",
                    data=form,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"Mikroservis hatası (HTTP {response.status}): {error_text}")
                    
                    result = await response.json()
            
            logger.info(f"PaddleOCR mikroservis yanıtı alındı: {result.get('line_count', 0)} satır")
            
            # Yanıtı standart formata çevir
            return {
                "text": result.get("text", ""),
                "structured_data": {},
                "confidence": result.get("confidence", 0.0),
                "token_count": None,
                "metadata": {
                    "line_count": result.get("line_count", 0),
                    "page_count": 1,  # Her çağrı 1 sayfa işliyor
                    "service": "PaddleOCR Mikroservis",
                    "microservice_url": self.service_url
                },
                "raw_response": result.get("metadata", {})
            }
            
        except aiohttp.ClientError as e:
            raise Exception(f"PaddleOCR mikroservis bağlantı hatası: {str(e)}")
        except Exception as e:
            raise Exception(f"PaddleOCR hatası: {str(e)}")
