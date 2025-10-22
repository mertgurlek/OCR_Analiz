"""
OCR Response Model
Tüm OCR servisleri için standart response formatı
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class OCRResponse(BaseModel):
    """
    Standart OCR response modeli
    Tüm OCR servisleri bu formatı döndürmelidir
    """
    
    text: str = Field(
        description="OCR ile çıkarılan ham metin",
        default=""
    )
    
    structured_data: Optional[Dict[str, Any]] = Field(
        description="Yapılandırılmış veri (entities, key-value pairs, vb.)",
        default=None
    )
    
    confidence: Optional[float] = Field(
        description="Güven skoru (0.0 - 1.0)",
        default=None,
        ge=0.0,
        le=1.0
    )
    
    token_count: Optional[int] = Field(
        description="Kullanılan token sayısı (OpenAI gibi token-based modeller için)",
        default=None
    )
    
    metadata: Dict[str, Any] = Field(
        description="Ek metadata (page_count, line_count, vb.)",
        default_factory=dict
    )
    
    raw_response: Optional[Dict[str, Any]] = Field(
        description="API'den gelen ham yanıt (debugging için)",
        default=None
    )
    
    error: Optional[str] = Field(
        description="Hata mesajı (hata durumunda)",
        default=None
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "MARKET FİŞİ\nToplam: 150.75 TL",
                "structured_data": {
                    "merchant": "ABC Market",
                    "total": 150.75,
                    "date": "2025-01-16"
                },
                "confidence": 0.95,
                "token_count": 1250,
                "metadata": {
                    "page_count": 1,
                    "line_count": 15,
                    "processing_method": "gpt-4o"
                }
            }
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Legacy uyumluluk için dict'e çevir"""
        return {
            "text": self.text,
            "structured_data": self.structured_data,
            "confidence": self.confidence,
            "token_count": self.token_count,
            "metadata": self.metadata,
            "raw_response": self.raw_response,
            **({"error": self.error} if self.error else {})
        }
