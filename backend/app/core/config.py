from pydantic_settings import BaseSettings
from typing import List, Dict, Any, TYPE_CHECKING
import os

if TYPE_CHECKING:
    from ..models.schemas import OCRModelType

# Constants
DEFAULT_TIMEOUT = 60  # seconds
MAX_FILE_SIZE_MB = 20
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
DEFAULT_OCR_TIMEOUT = 30  # seconds
DEFAULT_GPT_TIMEOUT = 20  # seconds


class Settings(BaseSettings):
    """Uygulama ayarları"""
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./ocr_test.db"
    
    # Google Document AI
    GOOGLE_CLOUD_PROJECT_ID: str = ""
    GOOGLE_CLOUD_LOCATION: str = "us"
    GOOGLE_CLOUD_PROCESSOR_ID: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    
    # Amazon Textract
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_VISION_MODEL: str = "gpt-4o"  # Vision specific
    OPENAI_ACCOUNTING_MODEL: str = "gpt-4o-mini"  # For accounting extraction
    
    # Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = MAX_FILE_SIZE_BYTES  # 20MB
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """CORS için izinli origin listesi"""
        if not self.ALLOWED_ORIGINS:
            return ["*"]  # Allow all if not specified
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
    
    def get_google_config(self) -> dict:
        """Google Document AI konfigürasyonu"""
        if self.GOOGLE_APPLICATION_CREDENTIALS:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = self.GOOGLE_APPLICATION_CREDENTIALS
        
        return {
            "project_id": self.GOOGLE_CLOUD_PROJECT_ID,
            "location": self.GOOGLE_CLOUD_LOCATION,
            "processor_id": self.GOOGLE_CLOUD_PROCESSOR_ID
        }
    
    def get_aws_config(self) -> dict:
        """AWS Textract konfigürasyonu"""
        return {
            "access_key_id": self.AWS_ACCESS_KEY_ID,
            "secret_access_key": self.AWS_SECRET_ACCESS_KEY,
            "region": self.AWS_REGION
        }
    
    def get_openai_config(self) -> dict:
        """OpenAI konfigürasyonu"""
        return {
            "api_key": self.OPENAI_API_KEY,
            "model": self.OPENAI_MODEL
        }
    
    def get_paddle_config(self) -> dict:
        """PaddleOCR konfigürasyonu (parametresiz)"""
        return {}
    
    def get_model_config(self, model_type: 'OCRModelType') -> Dict[str, Any]:
        """
        Model tipine göre config döndür - Tek sorumluluk prensibi
        
        Args:
            model_type: OCR model tipi
            
        Returns:
            Model konfigürasyonu
            
        Raises:
            ValueError: Desteklenmeyen model tipi için
        """
        # Import here to avoid circular dependency
        from ..models.schemas import OCRModelType
        
        config_map = {
            OCRModelType.GOOGLE_DOCAI: self.get_google_config,
            OCRModelType.AMAZON_TEXTRACT: self.get_aws_config,
            OCRModelType.OPENAI_VISION: self.get_openai_config,
            OCRModelType.PADDLE_OCR: self.get_paddle_config
        }
        
        config_func = config_map.get(model_type)
        if not config_func:
            raise ValueError(f"Desteklenmeyen model tipi: {model_type}")
        
        return config_func()


# Global settings instance
settings = Settings()
