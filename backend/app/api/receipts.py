"""
Fiş Datası API Endpoints
Toplu fiş yükleme, kırpma, ground truth yönetimi
"""
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import List, Optional, Dict
from collections import defaultdict
import os
import uuid
import logging
import hashlib
from datetime import datetime
from PIL import Image
import io

logger = logging.getLogger(__name__)

from ..database.database import get_db
from ..database.models import Receipt, PromptTest
from ..models.schemas import (
    ReceiptCreate,
    ReceiptUpdate,
    ReceiptResponse,
    ReceiptListResponse,
    ReceiptStatistics,
    ModelTestStats
)
from ..core.config import settings

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])


def calculate_file_hash(file_content: bytes) -> str:
    """Dosya içeriğinin MD5 hash'ini hesapla"""
    return hashlib.md5(file_content).hexdigest()


async def get_next_receipt_number(db: AsyncSession) -> int:
    """Bir sonraki fiş numarasını getir (test{n} için)"""
    result = await db.execute(select(func.count()).select_from(Receipt))
    count = result.scalar()
    return count + 1


def convert_path_to_url(file_path: str) -> str:
    """
    Dosya yolunu API URL'ine çevir
    Örn: ./uploads/receipt_xxx.jpg -> /uploads/receipt_xxx.jpg
    """
    if not file_path:
        return file_path
    
    # Sadece filename'i al
    filename = os.path.basename(file_path)
    # /uploads/ prefix'i ile döndür
    return f"/uploads/{filename}"


async def calculate_model_stats(receipt_id: str, db: AsyncSession) -> Dict[str, ModelTestStats]:
    """
    Bir fiş için model bazında test istatistiklerini hesapla
    """
    # Bu fişe ait tüm testleri al
    result = await db.execute(
        select(PromptTest).where(PromptTest.receipt_id == receipt_id)
    )
    tests = result.scalars().all()
    
    # Model bazında grupla
    model_stats = {}
    for test in tests:
        model_name = test.model_name
        if model_name not in model_stats:
            model_stats[model_name] = {"test_count": 0, "success_count": 0}
        
        model_stats[model_name]["test_count"] += 1
        
        # Başarılı test kontrolü (label = "correct")
        if test.label == "correct":
            model_stats[model_name]["success_count"] += 1
    
    # ModelTestStats objelerine çevir
    result_stats = {}
    for model_name, stats in model_stats.items():
        test_count = stats["test_count"]
        success_count = stats["success_count"]
        success_rate = (success_count / test_count * 100) if test_count > 0 else 0.0
        
        result_stats[model_name] = ModelTestStats(
            test_count=test_count,
            success_count=success_count,
            success_rate=round(success_rate, 1)
        )
    
    return result_stats


@router.post("/upload", response_model=List[ReceiptResponse])
async def upload_receipts(
    files: List[UploadFile] = File(...),
    names: Optional[str] = Form(None),  # JSON array string
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON array string
    notes: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Toplu fiş yükleme
    """
    import json
    
    # Parse names, tags
    names_list = json.loads(names) if names else []
    tags_list = json.loads(tags) if tags else []
    
    receipts = []
    duplicates = []
    skipped_count = 0
    
    # Başlangıç numarasını al (otomatik isimlendirme için)
    next_number = await get_next_receipt_number(db)
    
    for idx, file in enumerate(files):
        try:
            # Dosya içeriğini oku
            file_content = await file.read()
            
            # Hash hesapla (duplicate kontrolu için)
            file_hash = calculate_file_hash(file_content)
            
            # Duplicate kontrolu
            existing = await db.execute(
                select(Receipt).where(Receipt.file_hash == file_hash)
            )
            if existing.scalar_one_or_none():
                logger.warning(f"⚠️ Duplicate file skipped: {file.filename} (hash: {file_hash[:8]}...)")
                duplicates.append(file.filename)
                skipped_count += 1
                continue
            
            # Dosyayı kaydet
            file_id = str(uuid.uuid4())
            file_ext = os.path.splitext(file.filename)[1]
            file_path = os.path.join(settings.UPLOAD_DIR, f"receipt_{file_id}{file_ext}")
            
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # Görsel boyutlarını al
            try:
                image = Image.open(io.BytesIO(file_content))
                width, height = image.size
            except:
                width, height = None, None
            
            # Fiş adı - otomatik isimlendirme veya kullanıcıdan gelen
            if idx < len(names_list) and names_list[idx]:
                receipt_name = names_list[idx]
            else:
                # Otomatik isimlendirme: test1, test2, test3...
                receipt_name = f"test{next_number}"
                next_number += 1
            
            # Database'e kaydet
            receipt = Receipt(
                name=receipt_name,
                category=category,
                original_image_path=file_path,
                file_hash=file_hash,
                file_size_bytes=len(file_content),
                image_width=width,
                image_height=height,
                tags=tags_list,
                notes=notes
            )
            
            db.add(receipt)
            await db.flush()
            
            receipts.append(ReceiptResponse(
                id=receipt.id,
                name=receipt.name,
                description=receipt.description,
                category=receipt.category,
                original_image_path=convert_path_to_url(receipt.original_image_path),
                cropped_image_path=convert_path_to_url(receipt.cropped_image_path) if receipt.cropped_image_path else None,
                is_cropped=receipt.is_cropped,
                file_hash=receipt.file_hash,
                ground_truth_data=receipt.ground_truth_data,
                has_ground_truth=receipt.has_ground_truth,
                file_size_bytes=receipt.file_size_bytes,
                image_width=receipt.image_width,
                image_height=receipt.image_height,
                tags=receipt.tags,
                notes=receipt.notes,
                created_at=receipt.created_at,
                updated_at=receipt.updated_at,
                test_count=receipt.test_count,
                success_count=receipt.success_count
            ))
            
        except Exception as e:
            logger.error(f"❌ Receipt upload error ({file.filename}): {e}", exc_info=True)
            continue
    
    await db.commit()
    
    # Sonuç logla
    logger.info(f"✅ Receipt upload completed: {len(receipts)} uploaded, {skipped_count} duplicates skipped")
    if duplicates:
        logger.info(f"   Skipped files: {', '.join(duplicates)}")
    
    return receipts


@router.get("", response_model=ReceiptListResponse)
async def get_receipts(
    category: Optional[str] = None,
    has_ground_truth: Optional[bool] = None,
    limit: int = 200,  # Increased from 50 to show all receipts
    offset: int = 0,
    include_model_stats: bool = True,  # Model istatistiklerini dahil et
    db: AsyncSession = Depends(get_db)
):
    """
    Fiş listesi
    """
    query = select(Receipt).order_by(desc(Receipt.created_at))
    
    if category:
        query = query.where(Receipt.category == category)
    
    if has_ground_truth is not None:
        query = query.where(Receipt.has_ground_truth == has_ground_truth)
    
    # Total count
    count_query = select(func.count()).select_from(Receipt)
    if category:
        count_query = count_query.where(Receipt.category == category)
    if has_ground_truth is not None:
        count_query = count_query.where(Receipt.has_ground_truth == has_ground_truth)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Paginated results
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    receipts_db = result.scalars().all()
    
    # Model istatistiklerini toplu olarak hesapla (performans için)
    all_model_stats = {}
    if include_model_stats and len(receipts_db) > 0:
        receipt_ids = [r.id for r in receipts_db]
        
        # Tüm fişlerin testlerini tek sorguda çek
        tests_result = await db.execute(
            select(PromptTest).where(PromptTest.receipt_id.in_(receipt_ids))
        )
        all_tests = tests_result.scalars().all()
        
        # Receipt ID bazında grupla
        receipt_test_map = defaultdict(list)
        for test in all_tests:
            receipt_test_map[test.receipt_id].append(test)
        
        # Her fiş için istatistikleri hesapla
        for receipt_id, tests in receipt_test_map.items():
            model_stats = {}
            for test in tests:
                model_name = test.model_name
                if model_name not in model_stats:
                    model_stats[model_name] = {"test_count": 0, "success_count": 0}
                
                model_stats[model_name]["test_count"] += 1
                if test.label == "correct":
                    model_stats[model_name]["success_count"] += 1
            
            # ModelTestStats objelerine çevir
            result_stats = {}
            for model_name, stats in model_stats.items():
                test_count = stats["test_count"]
                success_count = stats["success_count"]
                success_rate = (success_count / test_count * 100) if test_count > 0 else 0.0
                
                result_stats[model_name] = ModelTestStats(
                    test_count=test_count,
                    success_count=success_count,
                    success_rate=round(success_rate, 1)
                )
            
            all_model_stats[receipt_id] = result_stats
    
    receipts = []
    for r in receipts_db:
        # Model istatistiklerini al (önceden hesaplanmış)
        model_stats = all_model_stats.get(r.id) if include_model_stats else None
        
        receipts.append(ReceiptResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            category=r.category,
            original_image_path=convert_path_to_url(r.original_image_path),
            cropped_image_path=convert_path_to_url(r.cropped_image_path) if r.cropped_image_path else None,
            is_cropped=r.is_cropped,
            file_hash=r.file_hash,
            ground_truth_data=r.ground_truth_data,
            has_ground_truth=r.has_ground_truth,
            file_size_bytes=r.file_size_bytes,
            image_width=r.image_width,
            image_height=r.image_height,
            tags=r.tags,
            notes=r.notes,
            created_at=r.created_at,
            updated_at=r.updated_at,
            test_count=r.test_count,
            success_count=r.success_count,
            model_stats=model_stats
        ))
    
    return ReceiptListResponse(total=total, receipts=receipts)


@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Tek fiş detayı
    """
    result = await db.execute(select(Receipt).where(Receipt.id == receipt_id))
    receipt = result.scalars().first()
    
    if not receipt:
        raise HTTPException(404, "Fiş bulunamadı")
    
    return ReceiptResponse(
        id=receipt.id,
        name=receipt.name,
        description=receipt.description,
        category=receipt.category,
        original_image_path=convert_path_to_url(receipt.original_image_path),
        cropped_image_path=convert_path_to_url(receipt.cropped_image_path) if receipt.cropped_image_path else None,
        is_cropped=receipt.is_cropped,
        file_hash=receipt.file_hash,
        ground_truth_data=receipt.ground_truth_data,
        has_ground_truth=receipt.has_ground_truth,
        file_size_bytes=receipt.file_size_bytes,
        image_width=receipt.image_width,
        image_height=receipt.image_height,
        tags=receipt.tags,
        notes=receipt.notes,
        created_at=receipt.created_at,
        updated_at=receipt.updated_at,
        test_count=receipt.test_count,
        success_count=receipt.success_count
    )


@router.post("/{receipt_id}/crop", response_model=ReceiptResponse)
async def crop_receipt(
    receipt_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Fiş kırpma - Kırpılmış görseli yükle
    """
    result = await db.execute(select(Receipt).where(Receipt.id == receipt_id))
    receipt = result.scalars().first()
    
    if not receipt:
        raise HTTPException(404, "Fiş bulunamadı")
    
    # Kırpılmış görseli kaydet
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    cropped_path = os.path.join(settings.UPLOAD_DIR, f"receipt_{file_id}_cropped{file_ext}")
    
    file_content = await file.read()
    with open(cropped_path, "wb") as f:
        f.write(file_content)
    
    # Receipt güncelle
    receipt.cropped_image_path = cropped_path
    receipt.is_cropped = True
    receipt.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(receipt)
    
    return ReceiptResponse(
        id=receipt.id,
        name=receipt.name,
        description=receipt.description,
        category=receipt.category,
        original_image_path=convert_path_to_url(receipt.original_image_path),
        cropped_image_path=convert_path_to_url(receipt.cropped_image_path) if receipt.cropped_image_path else None,
        is_cropped=receipt.is_cropped,
        file_hash=receipt.file_hash,
        ground_truth_data=receipt.ground_truth_data,
        has_ground_truth=receipt.has_ground_truth,
        file_size_bytes=receipt.file_size_bytes,
        image_width=receipt.image_width,
        image_height=receipt.image_height,
        tags=receipt.tags,
        notes=receipt.notes,
        created_at=receipt.created_at,
        updated_at=receipt.updated_at,
        test_count=receipt.test_count,
        success_count=receipt.success_count
    )


@router.patch("/{receipt_id}", response_model=ReceiptResponse)
async def update_receipt(
    receipt_id: str,
    update_data: ReceiptUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Fiş güncelleme (Ground truth dahil)
    """
    result = await db.execute(select(Receipt).where(Receipt.id == receipt_id))
    receipt = result.scalars().first()
    
    if not receipt:
        raise HTTPException(404, "Fiş bulunamadı")
    
    # Güncellemeleri uygula
    if update_data.name is not None:
        receipt.name = update_data.name
    if update_data.description is not None:
        receipt.description = update_data.description
    if update_data.category is not None:
        receipt.category = update_data.category
    if update_data.tags is not None:
        receipt.tags = update_data.tags
    if update_data.notes is not None:
        receipt.notes = update_data.notes
    if update_data.ground_truth_data is not None:
        receipt.ground_truth_data = update_data.ground_truth_data
        receipt.has_ground_truth = True
    
    receipt.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(receipt)
    
    return ReceiptResponse(
        id=receipt.id,
        name=receipt.name,
        description=receipt.description,
        category=receipt.category,
        original_image_path=convert_path_to_url(receipt.original_image_path),
        cropped_image_path=convert_path_to_url(receipt.cropped_image_path) if receipt.cropped_image_path else None,
        is_cropped=receipt.is_cropped,
        file_hash=receipt.file_hash,
        ground_truth_data=receipt.ground_truth_data,
        has_ground_truth=receipt.has_ground_truth,
        file_size_bytes=receipt.file_size_bytes,
        image_width=receipt.image_width,
        image_height=receipt.image_height,
        tags=receipt.tags,
        notes=receipt.notes,
        created_at=receipt.created_at,
        updated_at=receipt.updated_at,
        test_count=receipt.test_count,
        success_count=receipt.success_count
    )


@router.delete("/{receipt_id}")
async def delete_receipt(
    receipt_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Fiş silme
    """
    result = await db.execute(select(Receipt).where(Receipt.id == receipt_id))
    receipt = result.scalars().first()
    
    if not receipt:
        raise HTTPException(404, "Fiş bulunamadı")
    
    # Dosyaları sil
    if os.path.exists(receipt.original_image_path):
        os.remove(receipt.original_image_path)
    if receipt.cropped_image_path and os.path.exists(receipt.cropped_image_path):
        os.remove(receipt.cropped_image_path)
    
    await db.delete(receipt)
    await db.commit()
    
    return {"message": "Fiş silindi", "receipt_id": receipt_id}


@router.get("/statistics/summary", response_model=ReceiptStatistics)
async def get_receipt_statistics(
    db: AsyncSession = Depends(get_db)
):
    """
    Fiş istatistikleri
    """
    result = await db.execute(select(Receipt))
    receipts = result.scalars().all()
    
    total_receipts = len(receipts)
    cropped_receipts = len([r for r in receipts if r.is_cropped])
    receipts_with_ground_truth = len([r for r in receipts if r.has_ground_truth])
    total_tests = sum(r.test_count for r in receipts)
    avg_test_per_receipt = total_tests / total_receipts if total_receipts > 0 else 0
    
    # Kategori bazlı
    by_category = {}
    for r in receipts:
        if r.category:
            by_category[r.category] = by_category.get(r.category, 0) + 1
    
    # Etiket bazlı
    by_tag = {}
    for r in receipts:
        if r.tags:
            for tag in r.tags:
                by_tag[tag] = by_tag.get(tag, 0) + 1
    
    return ReceiptStatistics(
        total_receipts=total_receipts,
        cropped_receipts=cropped_receipts,
        receipts_with_ground_truth=receipts_with_ground_truth,
        total_tests=total_tests,
        avg_test_per_receipt=avg_test_per_receipt,
        by_category=by_category,
        by_tag=by_tag
    )
