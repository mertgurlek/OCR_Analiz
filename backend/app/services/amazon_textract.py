"""
Amazon Textract Servisi - TEMİZ ve BASİT VERSİYON
Karmaşık özellikler kaldırıldı, sadece temel OCR
"""
from typing import Dict, Any, Optional
import logging
from .base import BaseOCRService
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AmazonTextractService(BaseOCRService):
    """Amazon Textract servisi - Sıfırdan yazıldı"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.model_name = "amazon_textract"
        
        # Fiyatlandırma
        self.pricing = {
            "per_page": 0.0015,  # detect_document_text: $1.50/1000 sayfa
            "per_1k_tokens": 0.0
        }
        
        # Credentials
        access_key = config.get("access_key_id")
        secret_key = config.get("secret_access_key")
        region = config.get("region", "us-east-1")
        
        logger.info("Initializing Amazon Textract client")
        logger.debug(f"Region: {region}, Access Key: {access_key[:10]}...")
        
        # Yeni session oluştur (cache olmasın)
        self.session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        
        # Client oluştur
        self.client = self.session.client('textract')
        logger.info("Amazon Textract client initialized successfully")
    
    async def process_image(
        self,
        image_bytes: bytes,
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Basit text extraction - detect_document_text API
        """
        logger.info(f"Amazon Textract analysis started (image size: {len(image_bytes):,} bytes)")
        
        try:
            # API çağrısı
            logger.debug("Calling detect_document_text API")
            
            response = self.client.detect_document_text(
                Document={'Bytes': image_bytes}
            )
            
            # Başarılı
            blocks = response.get('Blocks', [])
            logger.info(f"Textract completed successfully: {len(blocks)} blocks detected")
            
            # Text çıkar
            text_lines = []
            for block in blocks:
                if block['BlockType'] == 'LINE':
                    text_lines.append(block.get('Text', ''))
            
            final_text = '\n'.join(text_lines)
            logger.debug(f"Extracted text length: {len(final_text)} characters")
            
            return {
                "text": final_text,
                "structured_data": {},
                "confidence": 0.95,
                "token_count": None,
                "metadata": {
                    "block_count": len(blocks),
                    "page_count": 1,  # Tek sayfa işleniyor
                    "method": "detect_document_text"
                }
            }
            
        except ClientError as e:
            # AWS API hatası
            error_code = e.response['Error']['Code']
            error_msg = e.response['Error']['Message']
            http_status = e.response.get('ResponseMetadata', {}).get('HTTPStatusCode', 0)
            
            logger.error(
                f"Amazon Textract API error: {error_code} - {error_msg} (HTTP {http_status})",
                extra={
                    'error_code': error_code,
                    'http_status': http_status,
                    'access_key': self.client._request_signer._credentials.access_key,
                    'region': self.client._client_config.region_name
                },
                exc_info=True
            )
            
            raise Exception(f"Amazon Textract hatası: {error_msg}")
            
        except Exception as e:
            # Diğer hatalar
            logger.error(f"Amazon Textract unexpected error: {type(e).__name__} - {str(e)}", exc_info=True)
            raise Exception(f"Amazon Textract hatası: {str(e)}")
