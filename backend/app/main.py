from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete, and_
from typing import List, Optional
from contextlib import asynccontextmanager
import asyncio
import os
import logging
from datetime import datetime
import uuid

from .core.config import settings
from .database.database import init_db, get_db
from .database.models import Analysis, OCRResult, ModelEvaluation, PromptTest, Receipt
from .models.schemas import ModelStatistics, ModelPromptStatistics
from .models.schemas import (
    OCRModelType,
    AnalysisResponse,
    OCRResult as OCRResultSchema,
    AnalysisEvaluation,
    AnalysisHistory,
    AccountingAnalysisRequest,
    AccountingAnalysisResponse,
    PromptTestCreate,
    PromptTestLabel,
    PromptTestResponse,
    PromptTestStatistics
)
from .services import OCRServiceFactory
from .services.accounting_service import AccountingService
from .services.prompt_manager import PromptManager
from .api.receipts import router as receipts_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifecycle management"""
    # Startup
    logger.info("🚀 Starting OCR Comparison Platform...")
    try:
        await init_db()
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        logger.info(f"📁 Upload directory: {settings.UPLOAD_DIR}")
        logger.info("✅ Platform started successfully")
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down platform...")

# FastAPI app oluştur
app = FastAPI(
    title="Fiş Okuma OCR Karşılaştırma Platformu",
    description="4 farklı OCR modelini karşılaştıran platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files - Upload edilen görsellere erişim için
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(receipts_router)


@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "running",
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "timestamp": datetime.utcnow().isoformat(),
        "upload_dir": settings.UPLOAD_DIR,
        "upload_dir_exists": os.path.exists(settings.UPLOAD_DIR)
    }

@app.get("/api/prompt-versions/{model_name}")
async def get_prompt_versions(model_name: str):
    """
    Belirtilen OCR modeli için mevcut prompt versiyonlarını döndür
    
    Args:
        model_name: OCR model adı (paddle_ocr, openai_vision, google_docai, amazon_textract)
    """
    try:
        prompt_manager = PromptManager()
        versions = prompt_manager.get_available_versions(model_name)
        return {
            "model_name": model_name,
            "versions": versions,
            "current_version": max(versions) if versions else 1
        }
    except Exception as e:
        logger.error(f"Error getting prompt versions for {model_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_receipt(
    file: UploadFile = File(...),
    prompt: Optional[str] = Form(None),
    models: Optional[str] = Form(None),  # Comma-separated model names
    db: AsyncSession = Depends(get_db)
):
    """
    Fiş görselini analiz et
    
    Args:
        file: Yüklenecek fiş görseli
        prompt: Custom OCR prompt
        models: Kullanılacak modeller (comma-separated)
        db: Database session
    """
    try:
        logger.info(f"🔍 Starting analysis: {file.filename}")
        
        # Dosya boyutu kontrolü
        file_content = await file.read()
        if len(file_content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(400, "Dosya çok büyük (max 20MB)")
        
        # Dosya kaydet
        analysis_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file.filename)[1]
        file_path = os.path.join(settings.UPLOAD_DIR, f"{analysis_id}{file_ext}")
        
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Kullanılacak modelleri belirle
        if models:
            model_list = [OCRModelType(m.strip()) for m in models.split(",")]
        else:
            model_list = [
                OCRModelType.OPENAI_VISION,      # En akıllı model
                OCRModelType.GOOGLE_DOCAI,       # Google'ın güçlü OCR'ı
                OCRModelType.AMAZON_TEXTRACT,    # AWS'nin hızlı servisi
                OCRModelType.PADDLE_OCR          # Ücretsiz yerel model
            ]
        
        # Analysis kaydı oluştur
        analysis = Analysis(
            id=analysis_id,
            file_name=file.filename,
            file_path=file_path,
            file_size_bytes=len(file_content),
            prompt=prompt,
            upload_timestamp=datetime.utcnow()
        )
        db.add(analysis)
        await db.flush()
        
        # Her model için paralel OCR işlemi
        tasks = []
        for model_type in model_list:
            task = process_with_model(
                model_type=model_type,
                image_bytes=file_content,
                prompt=prompt,
                analysis_id=analysis_id,
                db=db
            )
            tasks.append(task)
        
        # Paralel çalıştır (60 saniye timeout - OpenAI için artırıldı)
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=60.0
            )
        except asyncio.TimeoutError:
            logger.error("❌ OCR processing timeout (60 seconds)")
            results = [Exception("Timeout - Processing took too long") for _ in tasks]
        
        # Sonuçları topla
        ocr_results = []
        total_cost = 0.0
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"❌ Model error [{model_list[i]}]: {result}")
                # Exception durumunda da boş sonuç döndür (hata mesajı ile)
                model_type = model_list[i]
                error_result = OCRResultSchema(
                    model_name=model_type,
                    text_content="",
                    processing_time_ms=0,
                    estimated_cost=0,
                    error=f"Timeout veya hata: {str(result)}"
                )
                ocr_results.append(error_result)
                
                # Database'e de kaydet
                ocr_result_db = OCRResult(
                    analysis_id=analysis_id,
                    model_name=model_type.value,
                    text_content="",
                    processing_time_ms=0,
                    error=f"Timeout veya hata: {str(result)}",
                    estimated_cost=0
                )
                db.add(ocr_result_db)
                continue
            
            ocr_results.append(result)
            total_cost += result.estimated_cost or 0.0
        
        # Toplam maliyeti güncelle
        analysis.total_cost = total_cost
        await db.commit()
        
        # Debug logging
        logger.info(f"📊 Analysis completed: {len(ocr_results)} results, cost: ${total_cost:.6f}")
        logger.debug(f"Results: {[r.model_name for r in ocr_results]}")
        
        # Response oluştur
        return AnalysisResponse(
            analysis_id=analysis_id,
            upload_timestamp=analysis.upload_timestamp,
            file_name=file.filename,
            file_size_bytes=len(file_content),
            results=ocr_results,
            total_cost=total_cost
        )
        
    except Exception as e:
        logger.error(f"❌ Analysis error: {str(e)}", exc_info=True)
        
        # HTTPException'ları yeniden fırlat
        if isinstance(e, HTTPException):
            raise e
        
        # Diğer hatalar için generic HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Analiz sırasında beklenmeyen bir hata oluştu: {str(e)}"
        )


def _create_ocr_result_db(
    analysis_id: str,
    model_type: OCRModelType,
    result: Optional[dict] = None,
    error: Optional[str] = None
) -> OCRResult:
    """
    OCR sonucunu DB modeline çevir - DRY prensibi
    
    Args:
        analysis_id: Analiz ID
        model_type: Model tipi
        result: OCR sonucu (başarılı ise)
        error: Hata mesajı (başarısız ise)
        
    Returns:
        OCRResult database modeli
    """
    if error or not result:
        # Hata durumu
        return OCRResult(
            analysis_id=analysis_id,
            model_name=model_type.value,
            text_content="",
            processing_time_ms=0,
            error=error or "Unknown error",
            estimated_cost=0
        )
    
    # Başarılı durum
    return OCRResult(
        analysis_id=analysis_id,
        model_name=model_type.value,
        text_content=result.get("text", ""),
        structured_data=result.get("structured_data"),
        confidence_score=result.get("confidence"),
        processing_time_ms=result.get("processing_time_ms", 0),
        token_count=result.get("token_count"),
        estimated_cost=result.get("estimated_cost", 0),
        error=result.get("error"),
        model_metadata=result.get("metadata")
    )


def _create_ocr_result_schema(
    model_type: OCRModelType,
    result: Optional[dict] = None,
    error: Optional[str] = None
) -> OCRResultSchema:
    """
    OCR sonucunu Schema'ya çevir - DRY prensibi
    
    Args:
        model_type: Model tipi
        result: OCR sonucu (başarılı ise)
        error: Hata mesajı (başarısız ise)
        
    Returns:
        OCRResultSchema response modeli
    """
    if error or not result:
        # Hata durumu
        return OCRResultSchema(
            model_name=model_type,
            text_content="",
            processing_time_ms=0,
            estimated_cost=0,
            error=error or "Unknown error"
        )
    
    # Başarılı durum
    return OCRResultSchema(
        model_name=model_type,
        text_content=result.get("text", ""),
        structured_data=result.get("structured_data"),
        confidence_score=result.get("confidence"),
        processing_time_ms=result.get("processing_time_ms", 0),
        token_count=result.get("token_count"),
        estimated_cost=result.get("estimated_cost", 0),
        error=result.get("error"),
        raw_response=result.get("raw_response")
    )


async def process_with_model(
    model_type: OCRModelType,
    image_bytes: bytes,
    prompt: Optional[str],
    analysis_id: str,
    db: AsyncSession
) -> OCRResultSchema:
    """
    Tek bir model ile işleme yap
    """
    try:
        # Config al - Artık tek satır! ✅
        config = settings.get_model_config(model_type)
        
        # Servisi oluştur
        service = OCRServiceFactory.create_service(model_type, config)
        
        # Analiz et
        result = await service.analyze(image_bytes, prompt)
        
        # Veritabanına kaydet - Helper function kullan ✅
        ocr_result = _create_ocr_result_db(analysis_id, model_type, result)
        db.add(ocr_result)
        
        # Schema'ya çevir - Helper function kullan ✅
        return _create_ocr_result_schema(model_type, result)
        
    except Exception as e:
        # Hata durumunda kaydet - Helper function kullan ✅
        ocr_result = _create_ocr_result_db(analysis_id, model_type, error=str(e))
        db.add(ocr_result)
        
        return _create_ocr_result_schema(model_type, error=str(e))


@app.post("/api/evaluate/{analysis_id}")
async def evaluate_analysis(
    analysis_id: str,
    evaluation: AnalysisEvaluation,
    db: AsyncSession = Depends(get_db)
):
    """
    Analiz sonucunu değerlendir (hangi modeller doğru yaptı)
    """
    # Analysis'i bul
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(404, "Analysis bulunamadı")
    
    # Mevcut değerlendirmeleri sil (FIX: Should be DELETE not SELECT)
    await db.execute(
        delete(ModelEvaluation).where(ModelEvaluation.analysis_id == analysis_id)
    )
    
    # Yeni değerlendirmeleri ekle
    for model_name in evaluation.correct_models:
        eval_record = ModelEvaluation(
            analysis_id=analysis_id,
            model_name=model_name.value,
            is_correct=True
        )
        db.add(eval_record)
    
    # Analysis'i güncelle
    analysis.evaluated = True
    analysis.notes = evaluation.notes
    analysis.ground_truth = evaluation.ground_truth
    
    await db.commit()
    
    return {"success": True, "message": "Değerlendirme kaydedildi"}


@app.get("/api/history", response_model=List[AnalysisHistory])
async def get_history(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """
    Analiz geçmişini getir
    """
    result = await db.execute(
        select(Analysis)
        .order_by(desc(Analysis.upload_timestamp))
        .limit(limit)
    )
    analyses = result.scalars().all()
    
    history_list = []
    for analysis in analyses:
        # Doğru modelleri getir
        eval_result = await db.execute(
            select(ModelEvaluation)
            .where(ModelEvaluation.analysis_id == analysis.id)
            .where(ModelEvaluation.is_correct == True)
        )
        evaluations = eval_result.scalars().all()
        
        correct_models = [OCRModelType(e.model_name) for e in evaluations]
        
        # Result count
        result_count_query = await db.execute(
            select(OCRResult).where(OCRResult.analysis_id == analysis.id)
        )
        model_count = len(result_count_query.scalars().all())
        
        history_list.append(
            AnalysisHistory(
                analysis_id=analysis.id,
                timestamp=analysis.upload_timestamp,
                file_name=analysis.file_name,
                model_count=model_count,
                total_cost=analysis.total_cost,
                evaluated=analysis.evaluated,
                correct_models=correct_models if correct_models else None
            )
        )
    
    return history_list


@app.get("/api/analysis/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Belirli bir analizi getir
    """
    # Analysis'i bul
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(404, "Analysis bulunamadı")
    
    # Results'ları getir
    results_query = await db.execute(
        select(OCRResult).where(OCRResult.analysis_id == analysis_id)
    )
    ocr_results_db = results_query.scalars().all()
    
    # Schema'ya çevir
    ocr_results = [
        OCRResultSchema(
            model_name=OCRModelType(r.model_name),
            text_content=r.text_content or "",
            structured_data=r.structured_data,
            confidence_score=r.confidence_score,
            processing_time_ms=r.processing_time_ms,
            token_count=r.token_count,
            estimated_cost=r.estimated_cost,
            error=r.error
        )
        for r in ocr_results_db
    ]
    
    return AnalysisResponse(
        analysis_id=analysis.id,
        upload_timestamp=analysis.upload_timestamp,
        file_name=analysis.file_name,
        file_size_bytes=analysis.file_size_bytes,
        results=ocr_results,
        total_cost=analysis.total_cost,
        original_image_path=analysis.original_image_path,
        cropped_image_path=analysis.cropped_image_path
    )


@app.post("/api/accounting-analysis/{analysis_id}", response_model=AccountingAnalysisResponse)
async def analyze_accounting(
    analysis_id: str,
    gpt_model: str = Form("gpt-4o-mini"),
    db: AsyncSession = Depends(get_db)
):
    """
    OCR sonuçlarını GPT ile muhasebe verisine dönüştür
    
    Args:
        analysis_id: Analiz ID'si
        gpt_model: Kullanılacak GPT modeli (gpt-4o-mini veya gpt-4.1-mini)
        db: Database session
    """
    try:
        logger.info(f"💰 Starting accounting analysis: {analysis_id} with {gpt_model}")
        
        # Analysis ve OCR sonuçlarını getir
        result = await db.execute(
            select(Analysis).where(Analysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        
        if not analysis:
            raise HTTPException(404, "Analysis bulunamadı")
        
        # OCR sonuçlarını getir
        results_query = await db.execute(
            select(OCRResult).where(OCRResult.analysis_id == analysis_id)
        )
        ocr_results_db = results_query.scalars().all()
        
        if not ocr_results_db:
            raise HTTPException(404, "OCR sonucu bulunamadı")
        
        # OCR sonuçlarını dict formatına çevir (structured_data ve metadata dahil)
        ocr_results = [
            {
                "model_name": r.model_name,
                "text_content": r.text_content or "",
                "structured_data": r.structured_data,  # Direkt field
                "entities": r.model_metadata.get("raw_response", {}).get("entities") if r.model_metadata else None,
                "error": r.error
            }
            for r in ocr_results_db
        ]
        
        # Muhasebe servisini başlat (seçili GPT modeli ile)
        accounting_service = AccountingService(
            api_key=settings.OPENAI_API_KEY,
            gpt_model=gpt_model
        )
        
        # Her model için ayrı ayrı muhasebe verisi çıkar
        model_results_list = await accounting_service.extract_accounting_data_per_model(ocr_results)
        
        # Toplam maliyet ve süreyi hesapla
        total_processing_time = sum(r.get("processing_time_ms", 0) for r in model_results_list)
        total_cost = sum(r.get("estimated_cost", 0) for r in model_results_list)
        
        logger.info(f"✅ Accounting analysis completed: {len(model_results_list)} models, {total_processing_time:.0f}ms, ${total_cost:.6f}")
        
        # Schema'ya uygun response oluştur
        from .models.schemas import ModelAccountingResult
        
        model_results = [
            ModelAccountingResult(
                model_name=r["model_name"],
                accounting_data=r["accounting_data"],
                raw_gpt_response=r.get("raw_gpt_response"),
                processing_time_ms=r["processing_time_ms"],
                estimated_cost=r["estimated_cost"],
                error=r.get("error")
            )
            for r in model_results_list
        ]
        
        return AccountingAnalysisResponse(
            analysis_id=analysis_id,
            model_results=model_results,
            total_processing_time_ms=total_processing_time,
            total_estimated_cost=total_cost
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Accounting analysis error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Muhasebe analizi sırasında hata oluştu: {str(e)}"
        )


# ==================== Prompt Yönetimi Endpoints ====================

@app.get("/api/prompts")
async def get_all_prompts():
    """Tüm modellerin prompt'larını getir"""
    try:
        prompt_manager = PromptManager()
        prompts = prompt_manager.get_all_prompts()
        return JSONResponse(content=prompts)
    except Exception as e:
        logger.error(f"❌ Error getting prompts: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Prompt'ları getirme hatası: {str(e)}")


@app.get("/api/prompts/{model_name}")
async def get_model_prompt(model_name: str):
    """Belirli bir modelin prompt'unu getir"""
    try:
        prompt_manager = PromptManager()
        prompt_data = prompt_manager.get_prompt(model_name)
        
        # Token sayısını hesapla ve ekle
        if "prompt" in prompt_data:
            prompt_data["token_count"] = prompt_manager.count_tokens(prompt_data["prompt"])
        
        return JSONResponse(content=prompt_data)
    except Exception as e:
        logger.error(f"❌ Error getting prompt for {model_name}: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Prompt getirme hatası: {str(e)}")


@app.post("/api/prompts/{model_name}")
async def save_model_prompt(model_name: str, prompt: str = Form(...)):
    """Belirli bir modelin prompt'unu kaydet ve versiyon artır"""
    try:
        prompt_manager = PromptManager()
        updated_data = prompt_manager.save_prompt(model_name, prompt)
        
        logger.info(f"✅ Prompt saved: {model_name} (v{updated_data['version']})")
        
        return JSONResponse(content={
            "success": True,
            "message": f"Prompt başarıyla kaydedildi (v{updated_data['version']})",
            "data": updated_data
        })
    except Exception as e:
        logger.error(f"❌ Error saving prompt for {model_name}: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Prompt kaydetme hatası: {str(e)}")


@app.get("/api/prompts/{model_name}/history")
async def get_prompt_history(model_name: str):
    """Belirli bir modelin prompt geçmişini getir"""
    try:
        prompt_manager = PromptManager()
        history = prompt_manager.get_prompt_history(model_name)
        
        # Her versiyona token sayısını ekle
        for item in history:
            if "prompt" in item:
                item["token_count"] = prompt_manager.count_tokens(item["prompt"])
        
        return JSONResponse(content=history)
    except Exception as e:
        logger.error(f"❌ Error getting prompt history for {model_name}: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Prompt geçmişi getirme hatası: {str(e)}")


@app.get("/api/prompts/{model_name}/version/{version}")
async def get_prompt_version(model_name: str, version: int):
    """Belirli bir prompt versiyonunu getir"""
    try:
        prompt_manager = PromptManager()
        version_data = prompt_manager.load_version(model_name, version)
        if not version_data:
            raise HTTPException(404, f"Version {version} not found")
        return JSONResponse(content=version_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error loading version {version} for {model_name}: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Versiyon yükleme hatası: {str(e)}")


@app.post("/api/prompts/{model_name}/restore/{version}")
async def restore_prompt_version(model_name: str, version: int):
    """Eski bir prompt versiyonunu geri yükle"""
    try:
        prompt_manager = PromptManager()
        restored = prompt_manager.restore_version(model_name, version)
        logger.info(f"✅ Restored version {version} for {model_name} as v{restored['version']}")
        return JSONResponse(content={
            "success": True,
            "message": f"Version {version} geri yüklendi (yeni versiyon: v{restored['version']})",
            "data": restored
        })
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"❌ Error restoring version {version} for {model_name}: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Versiyon geri yükleme hatası: {str(e)}")


@app.delete("/api/prompts/{model_name}/version/{version}")
async def delete_prompt_version(model_name: str, version: int):
    """Bir prompt versiyonunu sil"""
    try:
        prompt_manager = PromptManager()
        success = prompt_manager.delete_version(model_name, version)
        if not success:
            raise HTTPException(400, "Mevcut versiyon silinemez veya versiyon bulunamadı")
        logger.info(f"✅ Deleted version {version} for {model_name}")
        return JSONResponse(content={
            "success": True,
            "message": f"Version {version} silindi"
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting version {version} for {model_name}: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Versiyon silme hatası: {str(e)}")


# ==================== PROMPT TEST ENDPOINTS ====================

@app.post("/api/prompt-tests", response_model=PromptTestResponse)
async def create_prompt_test(
    file: UploadFile = File(...),
    model_name: str = Form(...),
    prompt_version: int = Form(...),
    gpt_prompt_used: str = Form(...),
    gpt_model: Optional[str] = Form(None),  # Kullanılan GPT modeli
    ocr_text: Optional[str] = Form(None),
    ocr_confidence: Optional[float] = Form(None),
    ocr_processing_time_ms: Optional[float] = Form(None),
    ocr_cost: Optional[float] = Form(None),  # OCR maliyeti ($)
    gpt_response_raw: Optional[str] = Form(None),
    accounting_data_json: Optional[str] = Form(None),  # JSON string
    gpt_processing_time_ms: Optional[float] = Form(None),
    gpt_cost: Optional[float] = Form(None),
    cropped: bool = Form(False),  # Kırpılmış mı?
    receipt_id: Optional[str] = Form(None),  # Fiş datası ID'si
    db: AsyncSession = Depends(get_db)
):
    """
    Yeni prompt testi oluştur (görsel + OCR + GPT sonucu kaydet)
    Not: Aynı görsel + model + versiyon kombinasyonu için tekrar kayıt oluşturulmaz,
    mevcut kayıt güncellenir.
    """
    try:
        # Görsel kaydet
        file_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file.filename)[1]
        file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}{file_ext}")
        
        file_content = await file.read()
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Accounting data JSON parse et
        accounting_data = None
        if accounting_data_json:
            import json
            try:
                accounting_data = json.loads(accounting_data_json)
            except:
                accounting_data = None
        
        # ÖNEMLİ: Aynı fiş + model + versiyon için mevcut kayıt var mı kontrol et
        # Bu sayede tekrar kayıt oluşturulmaz (tekillik sağlanır)
        existing_test = None
        if receipt_id:
            # Fiş ID'si varsa ona göre kontrol et
            existing_test_result = await db.execute(
                select(PromptTest)
                .where(
                    and_(
                        PromptTest.receipt_id == receipt_id,
                        PromptTest.model_name == model_name,
                        PromptTest.prompt_version == prompt_version
                    )
                )
            )
            existing_test = existing_test_result.scalars().first()
        
        if existing_test:
            # Mevcut kayıt varsa güncelle
            logger.info(f"♻️  Mevcut test güncelleniyor: {existing_test.id}")
            existing_test.ocr_text = ocr_text
            existing_test.ocr_confidence = ocr_confidence
            existing_test.ocr_processing_time_ms = ocr_processing_time_ms
            existing_test.ocr_cost = ocr_cost
            existing_test.gpt_model = gpt_model
            existing_test.gpt_prompt_used = gpt_prompt_used
            existing_test.gpt_response_raw = gpt_response_raw
            existing_test.accounting_data = accounting_data
            existing_test.gpt_processing_time_ms = gpt_processing_time_ms
            existing_test.gpt_cost = gpt_cost
            existing_test.cropped_image_path = file_path if cropped else None
            existing_test.receipt_id = receipt_id
            test = existing_test
        else:
            # Yeni kayıt oluştur
            logger.info(f"✨ Yeni test oluşturuluyor: {model_name} v{prompt_version}")
            test = PromptTest(
                model_name=model_name,
                prompt_version=prompt_version,
                original_image_path=file_path,
                cropped_image_path=file_path if cropped else None,
                ocr_text=ocr_text,
                ocr_confidence=ocr_confidence,
                ocr_processing_time_ms=ocr_processing_time_ms,
                ocr_cost=ocr_cost,
                gpt_model=gpt_model,
                gpt_prompt_used=gpt_prompt_used,
                gpt_response_raw=gpt_response_raw,
                accounting_data=accounting_data,
                gpt_processing_time_ms=gpt_processing_time_ms,
                gpt_cost=gpt_cost,
                receipt_id=receipt_id
            )
            db.add(test)
        
        await db.commit()
        await db.refresh(test)
        
        return PromptTestResponse(
            id=test.id,
            model_name=test.model_name,
            prompt_version=test.prompt_version,
            original_image_path=test.original_image_path,
            cropped_image_path=test.cropped_image_path,
            ocr_text=test.ocr_text,
            ocr_confidence=test.ocr_confidence,
            ocr_processing_time_ms=test.ocr_processing_time_ms,
            ocr_cost=test.ocr_cost,  # OCR maliyeti
            gpt_model=test.gpt_model,
            gpt_prompt_used=test.gpt_prompt_used,
            gpt_response_raw=test.gpt_response_raw,
            accounting_data=test.accounting_data,
            gpt_processing_time_ms=test.gpt_processing_time_ms,
            gpt_cost=test.gpt_cost,
            label=test.label,
            error_type=test.error_type,
            error_details=test.error_details,
            expected_output=test.expected_output,
            user_notes=test.user_notes,
            tags=test.tags,
            created_at=test.created_at,
            labeled_at=test.labeled_at
        )
        
    except Exception as e:
        logger.error(f"❌ Test oluşturma hatası: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Test oluşturma hatası: {str(e)}")


@app.patch("/api/prompt-tests/{test_id}/label")
async def label_prompt_test(
    test_id: str,
    label_data: PromptTestLabel,
    db: AsyncSession = Depends(get_db)
):
    """
    Prompt testini etiketle (doğru/yanlış, hata tipi, notlar)
    """
    try:
        result = await db.execute(select(PromptTest).where(PromptTest.id == test_id))
        test = result.scalars().first()
        
        if not test:
            raise HTTPException(404, "Test bulunamadı")
        
        # Etiketleme bilgilerini güncelle
        test.label = label_data.label
        test.error_type = label_data.error_type
        test.error_details = label_data.error_details
        test.expected_output = label_data.expected_output
        test.user_notes = label_data.user_notes
        test.tags = label_data.tags
        test.labeled_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(test)
        
        return {"message": "Test etiketlendi", "test_id": test_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Etiketleme hatası: {str(e)}")


@app.get("/api/prompt-tests", response_model=List[PromptTestResponse])
async def get_prompt_tests(
    model_name: Optional[str] = None,
    labeled_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Prompt testlerini listele (filtreleme ile)
    """
    try:
        query = select(PromptTest).order_by(desc(PromptTest.created_at))
        
        if model_name:
            query = query.where(PromptTest.model_name == model_name)
        
        if labeled_only:
            query = query.where(PromptTest.label.isnot(None))
        
        query = query.limit(limit).offset(offset)
        
        result = await db.execute(query)
        tests = result.scalars().all()
        
        return [
            PromptTestResponse(
                id=test.id,
                model_name=test.model_name,
                prompt_version=test.prompt_version,
                original_image_path=test.original_image_path,
                cropped_image_path=test.cropped_image_path,
                ocr_text=test.ocr_text,
                ocr_confidence=test.ocr_confidence,
                ocr_processing_time_ms=test.ocr_processing_time_ms,
                ocr_cost=test.ocr_cost,
                gpt_model=test.gpt_model,
                gpt_prompt_used=test.gpt_prompt_used,
                gpt_response_raw=test.gpt_response_raw,
                accounting_data=test.accounting_data,
                gpt_processing_time_ms=test.gpt_processing_time_ms,
                gpt_cost=test.gpt_cost,
                label=test.label,
                error_type=test.error_type,
                error_details=test.error_details,
                expected_output=test.expected_output,
                user_notes=test.user_notes,
                tags=test.tags,
                created_at=test.created_at,
                labeled_at=test.labeled_at
            )
            for test in tests
        ]
        
    except Exception as e:
        raise HTTPException(500, f"Test listesi getirme hatası: {str(e)}")


@app.get("/api/prompt-tests/statistics", response_model=PromptTestStatistics)
async def get_prompt_test_statistics(
    model_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Prompt test istatistiklerini getir
    """
    try:
        query = select(PromptTest)
        if model_name:
            query = query.where(PromptTest.model_name == model_name)
        
        result = await db.execute(query)
        tests = result.scalars().all()
        
        # İstatistikleri hesapla
        total_tests = len(tests)
        labeled_tests = len([t for t in tests if t.label])
        correct_tests = len([t for t in tests if t.label == "correct"])
        incorrect_tests = len([t for t in tests if t.label == "incorrect"])
        partial_tests = len([t for t in tests if t.label == "partial"])
        
        ocr_errors = len([t for t in tests if t.error_type == "ocr_error"])
        gpt_errors = len([t for t in tests if t.error_type == "gpt_error"])
        both_errors = len([t for t in tests if t.error_type == "both"])
        no_errors = len([t for t in tests if t.error_type == "none" or (t.label and not t.error_type)])
        
        # Model bazlı istatistikler (eski format)
        by_model = {}
        for test in tests:
            if test.model_name not in by_model:
                by_model[test.model_name] = {
                    "total": 0, "correct": 0, "incorrect": 0, "partial": 0, "labeled": 0
                }
            by_model[test.model_name]["total"] += 1
            if test.label:
                by_model[test.model_name]["labeled"] += 1
                by_model[test.model_name][test.label] += 1
        
        # Model bazlı detaylı istatistikler (yeni format)
        model_stats_dict = {}
        for test in tests:
            if test.model_name not in model_stats_dict:
                model_stats_dict[test.model_name] = {
                    "total": 0, "labeled": 0, "correct": 0, "incorrect": 0, "partial": 0,
                    "processing_times": [], "ocr_costs": [], "gpt_costs": [],
                    "ocr_errors": 0, "gpt_errors": 0, "both_errors": 0, "no_errors": 0
                }
            stats = model_stats_dict[test.model_name]
            stats["total"] += 1
            if test.label:
                stats["labeled"] += 1
                if test.label == "correct":
                    stats["correct"] += 1
                elif test.label == "incorrect":
                    stats["incorrect"] += 1
                elif test.label == "partial":
                    stats["partial"] += 1
            if test.ocr_processing_time_ms:
                stats["processing_times"].append(test.ocr_processing_time_ms)
            if test.ocr_cost:
                stats["ocr_costs"].append(test.ocr_cost)
            if test.gpt_cost:
                stats["gpt_costs"].append(test.gpt_cost)
            # Hata tipi sayımı
            if test.error_type == "ocr_error":
                stats["ocr_errors"] += 1
            elif test.error_type == "gpt_error":
                stats["gpt_errors"] += 1
            elif test.error_type == "both":
                stats["both_errors"] += 1
            elif test.error_type == "none" or (test.label and not test.error_type):
                stats["no_errors"] += 1
        
        model_stats = []
        for model_name, stats in model_stats_dict.items():
            avg_time = sum(stats["processing_times"]) / len(stats["processing_times"]) if stats["processing_times"] else 0.0
            avg_ocr_cost = sum(stats["ocr_costs"]) / len(stats["ocr_costs"]) if stats["ocr_costs"] else 0.0
            avg_gpt_cost = sum(stats["gpt_costs"]) / len(stats["gpt_costs"]) if stats["gpt_costs"] else 0.0
            model_stats.append(ModelStatistics(
                model_name=model_name,
                total_tests=stats["total"],
                labeled_tests=stats["labeled"],
                correct_tests=stats["correct"],
                incorrect_tests=stats["incorrect"],
                partial_tests=stats["partial"],
                avg_processing_time_ms=avg_time,
                avg_ocr_cost=avg_ocr_cost,
                avg_gpt_cost=avg_gpt_cost,
                ocr_errors=stats["ocr_errors"],
                gpt_errors=stats["gpt_errors"],
                both_errors=stats["both_errors"],
                no_errors=stats["no_errors"]
            ))
        
        # Prompt versiyonu bazlı
        by_prompt_version = {}
        for test in tests:
            v = test.prompt_version
            if v not in by_prompt_version:
                by_prompt_version[v] = {
                    "total": 0, "correct": 0, "incorrect": 0, "partial": 0, "labeled": 0
                }
            by_prompt_version[v]["total"] += 1
            if test.label:
                by_prompt_version[v]["labeled"] += 1
                by_prompt_version[v][test.label] += 1
        
        # Model x Prompt kombinasyon istatistikleri
        model_prompt_dict = {}
        for test in tests:
            key = (test.model_name, test.prompt_version)
            if key not in model_prompt_dict:
                model_prompt_dict[key] = {
                    "total": 0, "labeled": 0, "correct": 0, "incorrect": 0, "partial": 0
                }
            model_prompt_dict[key]["total"] += 1
            if test.label:
                model_prompt_dict[key]["labeled"] += 1
                if test.label == "correct":
                    model_prompt_dict[key]["correct"] += 1
                elif test.label == "incorrect":
                    model_prompt_dict[key]["incorrect"] += 1
                elif test.label == "partial":
                    model_prompt_dict[key]["partial"] += 1
        
        model_prompt_stats = []
        for (model_name, prompt_version), stats in model_prompt_dict.items():
            accuracy = (stats["correct"] / stats["labeled"] * 100) if stats["labeled"] > 0 else 0.0
            model_prompt_stats.append(ModelPromptStatistics(
                model_name=model_name,
                prompt_version=prompt_version,
                total_tests=stats["total"],
                labeled_tests=stats["labeled"],
                correct_tests=stats["correct"],
                incorrect_tests=stats["incorrect"],
                partial_tests=stats["partial"],
                accuracy_rate=accuracy
            ))
        
        # Ortalamalar
        ocr_confidences = [t.ocr_confidence for t in tests if t.ocr_confidence is not None]
        ocr_times = [t.ocr_processing_time_ms for t in tests if t.ocr_processing_time_ms is not None]
        gpt_times = [t.gpt_processing_time_ms for t in tests if t.gpt_processing_time_ms is not None]
        gpt_costs = [t.gpt_cost for t in tests if t.gpt_cost is not None]
        
        avg_ocr_confidence = sum(ocr_confidences) / len(ocr_confidences) if ocr_confidences else 0.0
        avg_ocr_processing_time_ms = sum(ocr_times) / len(ocr_times) if ocr_times else 0.0
        avg_gpt_processing_time_ms = sum(gpt_times) / len(gpt_times) if gpt_times else 0.0
        avg_gpt_cost = sum(gpt_costs) / len(gpt_costs) if gpt_costs else 0.0
        
        return PromptTestStatistics(
            total_tests=total_tests,
            labeled_tests=labeled_tests,
            correct_tests=correct_tests,
            incorrect_tests=incorrect_tests,
            partial_tests=partial_tests,
            ocr_errors=ocr_errors,
            gpt_errors=gpt_errors,
            both_errors=both_errors,
            no_errors=no_errors,
            model_stats=model_stats,
            model_prompt_stats=model_prompt_stats,
            by_model=by_model,
            by_prompt_version=by_prompt_version,
            avg_ocr_confidence=avg_ocr_confidence,
            avg_ocr_processing_time_ms=avg_ocr_processing_time_ms,
            avg_gpt_processing_time_ms=avg_gpt_processing_time_ms,
            avg_gpt_cost=avg_gpt_cost
        )
        
    except Exception as e:
        raise HTTPException(500, f"İstatistik getirme hatası: {str(e)}")


@app.get("/api/prompt-tests/{test_id}", response_model=PromptTestResponse)
async def get_prompt_test(
    test_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Tek bir prompt testinin detayını getir
    """
    try:
        result = await db.execute(select(PromptTest).where(PromptTest.id == test_id))
        test = result.scalars().first()
        
        if not test:
            raise HTTPException(404, "Test bulunamadı")
        
        return PromptTestResponse(
            id=test.id,
            model_name=test.model_name,
            prompt_version=test.prompt_version,
            original_image_path=test.original_image_path,
            cropped_image_path=test.cropped_image_path,
            ocr_text=test.ocr_text,
            ocr_confidence=test.ocr_confidence,
            ocr_processing_time_ms=test.ocr_processing_time_ms,
            gpt_model=test.gpt_model,
            gpt_prompt_used=test.gpt_prompt_used,
            gpt_response_raw=test.gpt_response_raw,
            accounting_data=test.accounting_data,
            gpt_processing_time_ms=test.gpt_processing_time_ms,
            gpt_cost=test.gpt_cost,
            label=test.label,
            error_type=test.error_type,
            error_details=test.error_details,
            expected_output=test.expected_output,
            user_notes=test.user_notes,
            tags=test.tags,
            created_at=test.created_at,
            labeled_at=test.labeled_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Test detayı getirme hatası: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
