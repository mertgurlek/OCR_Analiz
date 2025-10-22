from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, JSON, ForeignKey, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()


class Analysis(Base):
    """Analiz tablosu"""
    __tablename__ = "analyses"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    upload_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    prompt = Column(Text, nullable=True)
    total_cost = Column(Float, default=0.0)
    evaluated = Column(Boolean, default=False)
    ground_truth = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # İlişkiler
    results = relationship("OCRResult", back_populates="analysis", cascade="all, delete-orphan")
    evaluations = relationship("ModelEvaluation", back_populates="analysis", cascade="all, delete-orphan")


class OCRResult(Base):
    """OCR sonuç tablosu"""
    __tablename__ = "ocr_results"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id = Column(String, ForeignKey("analyses.id"), nullable=False, index=True)
    model_name = Column(String, nullable=False, index=True)
    text_content = Column(Text, nullable=True)
    structured_data = Column(JSON, nullable=True)
    confidence_score = Column(Float, nullable=True)
    processing_time_ms = Column(Float, nullable=False)
    token_count = Column(Integer, nullable=True)
    estimated_cost = Column(Float, default=0.0)
    error = Column(Text, nullable=True)
    model_metadata = Column("metadata", JSON, nullable=True)  # Model-specific metadata - SQLAlchemy reserved word workaround
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # İlişkiler
    analysis = relationship("Analysis", back_populates="results")


class ModelEvaluation(Base):
    """Model değerlendirme tablosu"""
    __tablename__ = "model_evaluations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id = Column(String, ForeignKey("analyses.id"), nullable=False, index=True)
    model_name = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    accuracy_score = Column(Float, nullable=True)  # Manuel veya otomatik skor
    notes = Column(Text, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # İlişkiler
    analysis = relationship("Analysis", back_populates="evaluations")
    
    # Index and Unique Constraint
    __table_args__ = (
        Index('idx_analysis_correct', 'analysis_id', 'is_correct'),
        Index('idx_unique_analysis_model', 'analysis_id', 'model_name', unique=True),
    )


class PromptTest(Base):
    """Prompt test ve etiketleme tablosu"""
    __tablename__ = "prompt_tests"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    model_name = Column(String, nullable=False, index=True)  # paddle_ocr, openai_vision, etc.
    prompt_version = Column(Integer, nullable=False, index=True)
    
    # Görsel ve OCR
    original_image_path = Column(String, nullable=False)
    cropped_image_path = Column(String, nullable=True)  # Kırpılmış görsel
    ocr_text = Column(Text, nullable=True)  # OCR çıktısı
    ocr_confidence = Column(Float, nullable=True)
    ocr_processing_time_ms = Column(Float, nullable=True)
    ocr_cost = Column(Float, nullable=True)  # OCR maliyeti ($)
    
    # GPT Muhasebe Analizi
    gpt_model = Column(String, nullable=True)  # Kullanılan GPT modeli (gpt-4o-mini, gpt-4.1-mini)
    gpt_prompt_used = Column(Text, nullable=False)  # Kullanılan prompt
    gpt_response_raw = Column(Text, nullable=True)  # Ham GPT yanıtı (JSON string)
    accounting_data = Column(JSON, nullable=True)  # Parse edilmiş muhasebe verisi
    gpt_processing_time_ms = Column(Float, nullable=True)
    gpt_cost = Column(Float, nullable=True)  # GPT maliyeti
    label = Column(String, nullable=True)  # "correct", "incorrect", "partial"
    error_type = Column(String, nullable=True)  # "ocr_error", "gpt_error", "both", "none"
    error_details = Column(JSON, nullable=True)  # Detailed error explanation
    expected_output = Column(JSON, nullable=True)  # Expected correct output
    user_notes = Column(Text, nullable=True)  # Kullanıcı notları
    
    # Metadata
    ocr_metadata = Column("ocr_metadata", JSON, nullable=True)  # OCR and GPT metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    labeled_at = Column(DateTime, nullable=True)  # Labeling timestamp
    
    # Additional information
    tags = Column(JSON, nullable=True)  # ["akaryakit", "yüksek_tutar", "karmaşık_kdv"]
    
    receipt_id = Column(String, ForeignKey("receipts.id"), nullable=True)
    receipt = relationship("Receipt", back_populates="tests")
    
    # Unique Constraint: Aynı fiş + model + versiyon için tekrar test oluşturulmasın
    # Not: receipt_id nullable olduğu için unique constraint partial index olarak uygulanmalı
    # SQLite'da partial index desteklenmediği için şimdilik API seviyesinde kontrol ediyoruz
    __table_args__ = (
        Index('idx_test_lookup', 'receipt_id', 'model_name', 'prompt_version'),
    )


class Receipt(Base):
    """Fiş Datası - Toplu test için fiş arşivi"""
    __tablename__ = "receipts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)  # "Akaryakıt Fişi #1"
    description = Column(Text, nullable=True)  # Açıklama
    category = Column(String, nullable=True)  # "akaryakit", "market", "restoran", etc.
    
    # Görsel dosyaları
    original_image_path = Column(String, nullable=False)
    cropped_image_path = Column(String, nullable=True)
    is_cropped = Column(Boolean, default=False)
    file_hash = Column(String, nullable=True, unique=True, index=True)  # MD5 hash for duplicate detection
    
    # Ground Truth - Doğru sonuçlar (manuel girilmiş)
    ground_truth_data = Column(JSON, nullable=True)  # Doğru muhasebe verisi
    has_ground_truth = Column(Boolean, default=False)
    
    # Metadata
    file_size_bytes = Column(Integer, nullable=False)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    
    # Etiketler ve notlar
    tags = Column(JSON, nullable=True)  # ["test_set", "karmaşık", "yüksek_kdv"]
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # İstatistikler
    test_count = Column(Integer, default=0)  # Bu fişle kaç test yapıldı
    success_count = Column(Integer, default=0)  # Kaç tanesi başarılı
    
    # İlişkiler
    tests = relationship("PromptTest", back_populates="receipt", cascade="all, delete-orphan")
