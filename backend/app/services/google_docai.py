from typing import Dict, Any, Optional
from .base import BaseOCRService
from google.cloud import documentai_v1 as documentai
from google.api_core.client_options import ClientOptions
import json


class GoogleDocAIService(BaseOCRService):
    """Google Document AI servisi"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.model_name = "google_docai"
        
        # Fiyatlandırma: $1.50 per 1000 pages (ilk 1000)
        self.pricing = {
            "per_page": 0.0015,
            "per_1k_tokens": 0.0
        }
        
        # Client oluştur
        project_id = config.get("project_id")
        location = config.get("location", "us")
        processor_id = config.get("processor_id")
        
        if not all([project_id, processor_id]):
            raise ValueError("Google Document AI için project_id ve processor_id gerekli")
        
        self.processor_name = f"projects/{project_id}/locations/{location}/processors/{processor_id}"
        
        opts = ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com")
        self.client = documentai.DocumentProcessorServiceClient(client_options=opts)
    
    async def process_image(
        self,
        image_bytes: bytes,
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Google Document AI ile görseli işle
        
        Args:
            image_bytes: Görsel verisi
            prompt: Kullanılmıyor (Document AI prompt desteklemiyor)
            
        Returns:
            OCR sonucu
        """
        try:
            # Raw document oluştur
            raw_document = documentai.RawDocument(
                content=image_bytes,
                mime_type="image/png"
            )
            
            # Request oluştur
            request = documentai.ProcessRequest(
                name=self.processor_name,
                raw_document=raw_document
            )
            
            # İşle
            result = self.client.process_document(request=request)
            document = result.document
            
            # Text çıkar
            text = document.text
            
            # Yapılandırılmış veri çıkar
            structured_data = self._extract_structured_data(document)
            
            # Confidence hesapla (ortalama)
            confidence = self._calculate_confidence(document)
            
            return {
                "text": text,
                "structured_data": structured_data,
                "confidence": confidence,
                "token_count": None,  # Google token bazlı ücretlendirme yapmıyor
                "metadata": {
                    "page_count": len(document.pages),
                    "entity_count": len(document.entities)
                },
                "raw_response": {
                    "text": text,
                    "entities": [
                        {
                            "type": entity.type_,
                            "mention_text": entity.mention_text,
                            "confidence": entity.confidence
                        }
                        for entity in document.entities
                    ]
                }
            }
            
        except Exception as e:
            raise Exception(f"Google Document AI hatası: {str(e)}")
    
    def _extract_structured_data(self, document) -> Dict[str, Any]:
        """Document'tan yapılandırılmış veri çıkar"""
        structured = {}
        
        # Entities'den veri çıkar
        for entity in document.entities:
            key = entity.type_.replace("_", " ").title()
            value = entity.mention_text
            
            # Confidence threshold
            if entity.confidence > 0.5:
                structured[key] = {
                    "value": value,
                    "confidence": round(entity.confidence, 3)
                }
        
        # Tables varsa çıkar
        if document.pages:
            tables = []
            for page in document.pages:
                for table in page.tables:
                    table_data = self._extract_table(table, document.text)
                    if table_data:
                        tables.append(table_data)
            
            if tables:
                structured["tables"] = tables
        
        return structured
    
    def _extract_table(self, table, text: str) -> Dict[str, Any]:
        """Tablo çıkar"""
        rows = []
        for row in table.body_rows:
            row_data = []
            for cell in row.cells:
                cell_text = self._get_text_from_layout(cell.layout, text)
                row_data.append(cell_text)
            rows.append(row_data)
        
        return {
            "rows": rows,
            "row_count": len(rows),
            "column_count": len(rows[0]) if rows else 0
        }
    
    def _get_text_from_layout(self, layout, text: str) -> str:
        """Layout'tan text çıkar"""
        if not layout.text_anchor.text_segments:
            return ""
        
        segments = []
        for segment in layout.text_anchor.text_segments:
            start_idx = int(segment.start_index) if segment.start_index else 0
            end_idx = int(segment.end_index) if segment.end_index else len(text)
            segments.append(text[start_idx:end_idx])
        
        return "".join(segments).strip()
    
    def _calculate_confidence(self, document) -> float:
        """Ortalama confidence hesapla"""
        if not document.entities:
            return 0.0
        
        total_confidence = sum(entity.confidence for entity in document.entities)
        return round(total_confidence / len(document.entities), 3)
