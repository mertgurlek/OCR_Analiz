"""
PaddleOCR Mikroservis
Port: 8001
Amaç: Protobuf çakışmasını önlemek için PaddleOCR'ı izole ortamda çalıştırma
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
import numpy as np
from PIL import Image
import io
from typing import Dict, Any
import logging

# Logging yapılandırması
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI uygulaması
app = FastAPI(
    title="PaddleOCR Mikroservis",
    description="İzole PaddleOCR servisi - Port 8001",
    version="1.0.0"
)

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PaddleOCR instance (global - bir kez yükle)
ocr_engine = None


def get_ocr_engine():
    """PaddleOCR engine'i lazy load"""
    global ocr_engine
    if ocr_engine is None:
        logger.info("Initializing PaddleOCR engine...")
        ocr_engine = PaddleOCR(
            use_angle_cls=False,
            lang='en',
            show_log=False,
            use_gpu=False
        )
        logger.info("PaddleOCR engine initialized successfully")
    return ocr_engine


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "PaddleOCR Mikroservis",
        "status": "running",
        "port": 8001,
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detaylı health check"""
    try:
        ocr = get_ocr_engine()
        return {
            "status": "healthy",
            "ocr_engine": "initialized" if ocr else "not_initialized"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@app.post("/ocr/process")
async def process_image(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Görsel üzerinde OCR işlemi yap
    
    Args:
        file: Yüklenecek görsel dosyası
        
    Returns:
        OCR sonuçları
    """
    try:
        logger.info(f"Processing image: {file.filename}")
        
        # Dosyayı oku
        image_bytes = await file.read()
        
        # PIL Image'e çevir
        image = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(image)
        
        logger.info(f"Image size: {img_array.shape}")
        
        # OCR işlemi
        ocr = get_ocr_engine()
        ocr_result = ocr.ocr(img_array, cls=False)
        
        # Sonuçları işle
        text_lines = []
        confidences = []
        
        if ocr_result and ocr_result[0]:
            for line in ocr_result[0]:
                if line and len(line) >= 2:
                    text = line[1][0]
                    confidence = line[1][1]
                    text_lines.append(text)
                    confidences.append(confidence)
        
        # Text birleştir
        full_text = '\n'.join(text_lines)
        
        # Ortalama confidence
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        logger.info(f"OCR completed: {len(text_lines)} lines detected")
        
        return {
            "success": True,
            "text": full_text,
            "line_count": len(text_lines),
            "confidence": round(avg_confidence, 3),
            "metadata": {
                "model": "PaddleOCR",
                "language": "en",
                "lines": text_lines,
                "confidences": [round(c, 3) for c in confidences]
            }
        }
        
    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR işlemi başarısız: {str(e)}")


@app.on_event("startup")
async def startup_event():
    """Uygulama başlangıcında çalışır"""
    logger.info("=" * 60)
    logger.info("🐼 PaddleOCR Mikroservis Başlatılıyor...")
    logger.info("Port: 8001")
    logger.info("=" * 60)
    # OCR engine'i önceden yükle
    get_ocr_engine()


@app.on_event("shutdown")
async def shutdown_event():
    """Uygulama kapanışında çalışır"""
    logger.info("PaddleOCR Mikroservis kapatılıyor...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
        log_level="info"
    )
