from typing import Dict, Any
from .base import BaseOCRService
from .google_docai import GoogleDocAIService
from .amazon_textract import AmazonTextractService
from .paddle_ocr import PaddleOCRService
from .openai_vision import OpenAIVisionService
from ..models.schemas import OCRModelType


class OCRServiceFactory:
    """OCR servis factory"""
    
    @staticmethod
    def create_service(
        model_type: OCRModelType,
        config: Dict[str, Any]
    ) -> BaseOCRService:
        """
        Model tipine göre OCR servisi oluştur
        
        Args:
            model_type: OCR model tipi
            config: Model konfigürasyonu
            
        Returns:
            OCR servisi instance'ı
        """
        services = {
            OCRModelType.GOOGLE_DOCAI: GoogleDocAIService,
            OCRModelType.AMAZON_TEXTRACT: AmazonTextractService,
            OCRModelType.PADDLE_OCR: PaddleOCRService,
            OCRModelType.OPENAI_VISION: OpenAIVisionService
        }
        
        service_class = services.get(model_type)
        if not service_class:
            raise ValueError(f"Desteklenmeyen model tipi: {model_type}")
        
        return service_class(config)


__all__ = [
    'BaseOCRService',
    'GoogleDocAIService',
    'AmazonTextractService', 
    'PaddleOCRService',
    'OpenAIVisionService',
    'OCRServiceFactory'
]
