from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple
from PIL import Image
import io
import time
import logging

logger = logging.getLogger(__name__)


class BaseOCRService(ABC):
    """Tüm OCR servisleri için base sınıf"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model_name = "base"
        # Model başına fiyatlandırma (USD per 1000 units)
        self.pricing = {
            "per_page": 0.0,
            "per_1k_tokens": 0.0
        }
    
    def preprocess_image(self, image_bytes: bytes) -> Tuple[bytes, Dict[str, Any]]:
        """
        Standart görsel ön işleme
        
        Args:
            image_bytes: Ham görsel verisi
            
        Returns:
            Tuple of (işlenmiş görsel, metadata)
        """
        try:
            # Görseli aç
            image = Image.open(io.BytesIO(image_bytes))
            
            # Metadata topla
            metadata = {
                "original_format": image.format,
                "original_size": image.size,
                "original_mode": image.mode
            }
            
            # RGB'ye çevir
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Çok büyük görselleri küçült (max 4096px)
            max_size = 4096
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = tuple(int(dim * ratio) for dim in image.size)
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                metadata["resized"] = True
                metadata["new_size"] = new_size
            
            # Bytes'a geri çevir
            output = io.BytesIO()
            image.save(output, format='PNG')
            processed_bytes = output.getvalue()
            
            return processed_bytes, metadata
            
        except Exception as e:
            logger.error(f"Image preprocessing error: {str(e)}", exc_info=True)
            raise ValueError(f"Görsel ön işleme hatası: {str(e)}")
    
    @abstractmethod
    async def process_image(
        self,
        image_bytes: bytes,
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Görseli OCR ile işle
        
        Args:
            image_bytes: Görsel verisi
            prompt: Opsiyonel prompt (destekleyen modeller için)
            
        Returns:
            Dict with keys: text, structured_data, confidence, metadata
        """
        pass
    
    async def analyze(
        self,
        image_bytes: bytes,
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tam analiz: ön işleme + OCR + maliyet hesaplama
        
        Returns:
            {
                "text": str,
                "structured_data": dict,
                "confidence": float,
                "processing_time_ms": float,
                "token_count": int,
                "estimated_cost": float,
                "metadata": dict
            }
        """
        start_time = time.time()
        
        try:
            # Ön işleme
            processed_bytes, preprocess_meta = self.preprocess_image(image_bytes)
            
            # OCR işleme
            result = await self.process_image(processed_bytes, prompt)
            
            # Süre hesaplama
            processing_time_ms = (time.time() - start_time) * 1000
            
            # Maliyet hesaplama
            cost = self.calculate_cost(result)
            
            return {
                "text": result.get("text", ""),
                "structured_data": result.get("structured_data"),
                "confidence": result.get("confidence"),
                "processing_time_ms": processing_time_ms,
                "token_count": result.get("token_count"),
                "estimated_cost": cost,
                "metadata": {
                    **preprocess_meta,
                    **result.get("metadata", {})
                },
                "raw_response": result.get("raw_response")
            }
            
        except Exception as e:
            processing_time_ms = (time.time() - start_time) * 1000
            logger.error(f"OCR processing error in {self.model_name}: {str(e)}", exc_info=True)
            return {
                "text": "",
                "structured_data": None,
                "confidence": 0.0,
                "processing_time_ms": processing_time_ms,
                "token_count": 0,
                "estimated_cost": 0.0,
                "error": str(e),
                "metadata": {}
            }
    
    def calculate_cost(self, result: Dict[str, Any]) -> float:
        """
        Maliyet hesaplama
        
        Args:
            result: process_image sonucu
            
        Returns:
            Maliyet (USD)
        """
        cost = 0.0
        
        # Sayfa bazlı fiyatlandırma
        if self.pricing["per_page"] > 0:
            # Metadata'dan page_count al (Google DocAI, Amazon Textract için)
            page_count = result.get("metadata", {}).get("page_count", 1)
            cost += self.pricing["per_page"] * page_count
        
        # Token bazlı fiyatlandırma (OpenAI Vision için)
        if self.pricing["per_1k_tokens"] > 0 and result.get("token_count"):
            cost += (result["token_count"] / 1000) * self.pricing["per_1k_tokens"]
        
        return round(cost, 6)
