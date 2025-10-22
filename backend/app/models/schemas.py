from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class CropArea(BaseModel):
    """Kırpma alanı bilgisi"""
    x: float
    y: float
    width: float
    height: float


class OCRModelType(str, Enum):
    """OCR model tipleri"""
    GOOGLE_DOCAI = "google_docai"
    AMAZON_TEXTRACT = "amazon_textract"
    PADDLE_OCR = "paddle_ocr"
    OPENAI_VISION = "openai_vision"


class OCRResult(BaseModel):
    """Tek bir OCR modelinin sonucu"""
    model_name: OCRModelType
    text_content: str
    structured_data: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    processing_time_ms: float
    token_count: Optional[int] = None
    estimated_cost: Optional[float] = None
    error: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


class AnalysisRequest(BaseModel):
    """Analiz isteği"""
    prompt: Optional[str] = Field(
        default="Lütfen bu fişten tüm bilgileri çıkarın: tarih, toplam tutar, ürünler, vergi numarası",
        description="OCR modeline gönderilecek prompt"
    )
    models: List[OCRModelType] = Field(
        default=[
            OCRModelType.GOOGLE_DOCAI,
            OCRModelType.AMAZON_TEXTRACT,
            OCRModelType.PADDLE_OCR,
            OCRModelType.OPENAI_VISION
        ],
        description="Kullanılacak OCR modelleri"
    )


class AnalysisResponse(BaseModel):
    """Analiz yanıtı"""
    analysis_id: str
    upload_timestamp: datetime
    file_name: str
    file_size_bytes: int
    results: List[OCRResult]
    total_cost: float
    best_model: Optional[OCRModelType] = None
    # Kırpma bilgileri
    has_cropped_version: bool = False
    crop_area: Optional[CropArea] = None
    original_file_size: Optional[int] = None
    # Görsel yolları
    original_image_path: Optional[str] = None
    cropped_image_path: Optional[str] = None


class AnalysisEvaluation(BaseModel):
    """Manuel değerlendirme"""
    analysis_id: str
    correct_models: List[OCRModelType]
    notes: Optional[str] = None
    ground_truth: Optional[str] = None


class AnalysisHistory(BaseModel):
    """Analiz geçmişi"""
    analysis_id: str
    timestamp: datetime
    file_name: str
    model_count: int
    total_cost: float
    evaluated: bool
    correct_models: Optional[List[OCRModelType]] = None


class LineItem(BaseModel):
    """Fiş kalemi/ürün"""
    description: str = Field(description="Ürün/hizmet adı")
    quantity: Optional[float] = Field(default=None, description="Miktar")
    unit_price: Optional[float] = Field(default=None, alias="unitPrice", description="Birim fiyat")
    gross_amount: float = Field(alias="grossAmount", description="Brüt tutar (KDV dahil)")
    net_amount: Optional[float] = Field(default=None, alias="netAmount", description="Net tutar (KDV hariç)")
    vat_rate: Optional[int] = Field(default=None, alias="vatRate", description="KDV oranı (%)")
    vat_amount: Optional[float] = Field(default=None, alias="vatAmount", description="KDV tutarı")
    discount_amount: Optional[float] = Field(default=0.0, alias="discountAmount", description="İndirim tutarı")
    account_code: Optional[str] = Field(default=None, alias="accountCode", description="Hesap kodu")
    item_type: Optional[str] = Field(default=None, alias="itemType", description="Ürün tipi")
    confidence: Optional[float] = Field(default=None, description="Güven skoru (0.0-1.0)")
    
    model_config = ConfigDict(populate_by_name=True)  # Hem alias hem de field name'i kabul et


class VATBreakdown(BaseModel):
    """KDV oranlarına göre ayrım"""
    vat_rate: int = Field(alias="vatRate", description="KDV oranı (%)")
    tax_base: float = Field(alias="taxBase", description="Matrah (KDV hariç tutar)")
    vat_amount: float = Field(alias="vatAmount", description="KDV tutarı")
    
    model_config = ConfigDict(populate_by_name=True)


class MetadataInfo(BaseModel):
    """Metadata bilgisi"""
    source: Optional[str] = Field(default=None, description="Kaynak (OCR modeli)")
    ocr_quality_score: Optional[float] = Field(default=None, alias="ocrQualityScore", description="OCR kalite skoru")
    classification: Optional[str] = Field(default=None, description="Fiş sınıflandırması (grocery, fuel, etc)")
    vat_treatment: Optional[str] = Field(default=None, alias="vatTreatment", description="KDV muamelesi (included/excluded)")
    notes: Optional[str] = Field(default=None, description="Notlar")
    
    model_config = ConfigDict(populate_by_name=True)


class DocumentInfo(BaseModel):
    """Belge bilgileri"""
    merchant_name: Optional[str] = Field(default=None, alias="merchantName", description="Firma adı")
    merchant_vkn: Optional[str] = Field(default=None, alias="merchantVKN", description="Vergi Kimlik Numarası")
    merchant_tckn: Optional[str] = Field(default=None, alias="merchantTCKN", description="TC Kimlik No")
    address: Optional[str] = Field(default=None, description="Adres")
    date: Optional[str] = Field(default=None, description="Tarih")
    time: Optional[str] = Field(default=None, description="Saat")
    receipt_no: Optional[str] = Field(default=None, alias="receiptNo", description="Fiş numarası")
    plate: Optional[str] = Field(default=None, description="Plaka")
    invoice_no: Optional[str] = Field(default=None, alias="invoiceNo", description="Fatura numarası")
    mersis_no: Optional[str] = Field(default=None, alias="mersisNo", description="MERSİS numarası")
    
    model_config = ConfigDict(populate_by_name=True)


class ExtraTax(BaseModel):
    """Ek vergi/harç"""
    type: str = Field(description="Vergi tipi")
    amount: float = Field(description="Tutar")


class TotalsInfo(BaseModel):
    """Toplam bilgileri"""
    vat_breakdown: List[VATBreakdown] = Field(default=[], alias="vatBreakdown", description="KDV dağılımı")
    total_vat: Optional[float] = Field(default=None, alias="totalVat", description="Toplam KDV")
    total_amount: Optional[float] = Field(default=None, alias="totalAmount", description="Genel toplam")
    payment_account_code: Optional[str] = Field(default=None, alias="paymentAccountCode", description="Ödeme hesap kodu")
    currency: Optional[str] = Field(default="TRY", description="Para birimi")
    
    model_config = ConfigDict(populate_by_name=True)


class PaymentLine(BaseModel):
    """Ödeme satırı"""
    method: str = Field(description="Ödeme yöntemi")
    amount: float = Field(description="Tutar")
    account_code: str = Field(alias="accountCode", description="Hesap kodu")
    
    model_config = ConfigDict(populate_by_name=True)


class EntryLine(BaseModel):
    """Muhasebe yevmiye kaydı"""
    account_code: str = Field(alias="accountCode", description="Hesap kodu")
    debit: float = Field(description="Borç")
    credit: float = Field(description="Alacak")
    description: str = Field(description="Açıklama")
    
    model_config = ConfigDict(populate_by_name=True)


class StatsInfo(BaseModel):
    """İstatistik bilgileri"""
    item_count: int = Field(default=0, alias="itemCount", description="Kalem sayısı")
    parsed_lines: int = Field(default=0, alias="parsedLines", description="Parse edilen satır sayısı")
    unprocessed_count: int = Field(default=0, alias="unprocessedCount", description="İşlenemeyen satır sayısı")
    
    model_config = ConfigDict(populate_by_name=True)


class AccountingData(BaseModel):
    """Muhasebe verisi - Yeni yapılandırılmış format"""
    metadata: Optional[MetadataInfo] = Field(default=None, description="Metadata bilgileri")
    document: Optional[DocumentInfo] = Field(default=None, description="Belge bilgileri")
    items: List[LineItem] = Field(default=[], description="Ürün/hizmet kalemleri")
    extra_taxes: List[ExtraTax] = Field(default=[], alias="extraTaxes", description="Ek vergiler")
    totals: Optional[TotalsInfo] = Field(default=None, description="Toplam bilgileri")
    payment_lines: List[PaymentLine] = Field(default=[], alias="paymentLines", description="Ödeme satırları")
    entry_lines: List[EntryLine] = Field(default=[], alias="entryLines", description="Muhasebe kayıtları")
    unprocessed_lines: List[str] = Field(default=[], alias="unprocessedLines", description="İşlenemeyen satırlar")
    validation_flags: List[str] = Field(default=[], alias="validationFlags", description="Uyarı bayrakları")
    error_flags: List[str] = Field(default=[], alias="errorFlags", description="Hata bayrakları")
    stats: Optional[StatsInfo] = Field(default=None, description="İstatistikler")
    
    model_config = ConfigDict(populate_by_name=True)
    

class AccountingAnalysisRequest(BaseModel):
    """Muhasebe analiz isteği"""
    analysis_id: str = Field(description="Analiz ID'si")


class ModelAccountingResult(BaseModel):
    """Tek bir model için muhasebe analiz sonucu"""
    model_name: str = Field(description="Model adı")
    accounting_data: Dict[str, Any] = Field(description="Çıkarılan muhasebe verisi (V1 flat format for frontend)")
    raw_gpt_response: Optional[str] = Field(default=None, description="Ham GPT yanıtı")
    processing_time_ms: float = Field(description="İşlem süresi (ms)")
    estimated_cost: float = Field(description="Tahmini maliyet ($)")
    error: Optional[str] = Field(default=None, description="Hata mesajı varsa")


class AccountingAnalysisResponse(BaseModel):
    """Muhasebe analiz yanıtı - Tüm modeller için"""
    analysis_id: str
    model_results: List[ModelAccountingResult] = Field(description="Her model için ayrı muhasebe verisi")
    total_processing_time_ms: float = Field(description="Toplam işlem süresi")
    total_estimated_cost: float = Field(description="Toplam tahmini maliyet")


# ==================== PROMPT TEST SCHEMAS ====================

class PromptTestCreate(BaseModel):
    """Prompt test oluşturma"""
    model_name: str = Field(description="Model adı (paddle_ocr, openai_vision, etc.)")
    prompt_version: int = Field(description="Prompt versiyonu")
    gpt_prompt_used: str = Field(description="Kullanılan GPT prompt'u")
    ocr_text: Optional[str] = Field(default=None, description="OCR çıktısı")
    ocr_confidence: Optional[float] = Field(default=None, description="OCR güven skoru")
    ocr_processing_time_ms: Optional[float] = Field(default=None, description="OCR işlem süresi")
    gpt_response_raw: Optional[str] = Field(default=None, description="Ham GPT yanıtı")
    accounting_data: Optional[Dict[str, Any]] = Field(default=None, description="Parse edilmiş muhasebe verisi")
    gpt_processing_time_ms: Optional[float] = Field(default=None, description="GPT işlem süresi")
    gpt_cost: Optional[float] = Field(default=None, description="GPT maliyeti")


class PromptTestLabel(BaseModel):
    """Prompt test etiketleme"""
    label: str = Field(description="Etiket: correct, incorrect, partial")
    error_type: Optional[str] = Field(default=None, description="Hata tipi: ocr_error, gpt_error, both, none")
    error_details: Optional[Dict[str, Any]] = Field(default=None, description="Detaylı hata açıklaması")
    expected_output: Optional[Dict[str, Any]] = Field(default=None, description="Beklenen doğru çıktı")
    user_notes: Optional[str] = Field(default=None, description="Kullanıcı notları")
    tags: Optional[List[str]] = Field(default=None, description="Etiketler")


class PromptTestResponse(BaseModel):
    """Prompt test yanıtı"""
    id: str
    model_name: str
    prompt_version: int
    original_image_path: str
    cropped_image_path: Optional[str]
    ocr_text: Optional[str]
    ocr_confidence: Optional[float]
    ocr_processing_time_ms: Optional[float]
    ocr_cost: Optional[float]  # OCR maliyeti ($)
    gpt_model: Optional[str]  # Kullanılan GPT modeli
    gpt_prompt_used: Optional[str]
    gpt_response_raw: Optional[str]
    accounting_data: Optional[Dict[str, Any]]
    gpt_processing_time_ms: Optional[float]
    gpt_cost: Optional[float]
    label: Optional[str]
    error_type: Optional[str]
    error_details: Optional[Dict[str, Any]]
    expected_output: Optional[Dict[str, Any]]
    user_notes: Optional[str]
    tags: Optional[List[str]]
    created_at: datetime
    labeled_at: Optional[datetime]


class ModelStatistics(BaseModel):
    """Model bazlı istatistik"""
    model_name: str = Field(description="Model adı")
    total_tests: int = Field(description="Toplam test sayısı")
    labeled_tests: int = Field(description="Etiketlenmiş test sayısı")
    correct_tests: int = Field(description="Doğru test sayısı")
    incorrect_tests: int = Field(description="Yanlış test sayısı")
    partial_tests: int = Field(description="Kısmi doğru test sayısı")
    avg_processing_time_ms: float = Field(description="Ortalama işlem süresi")
    avg_ocr_cost: float = Field(description="Ortalama OCR maliyeti ($)")
    avg_gpt_cost: float = Field(description="Ortalama GPT maliyeti ($)")
    # Model bazlı hata tipleri
    ocr_errors: int = Field(default=0, description="Bu modeldeki OCR hata sayısı")
    gpt_errors: int = Field(default=0, description="Bu modeldeki GPT hata sayısı")
    both_errors: int = Field(default=0, description="Bu modeldeki her iki hata sayısı")
    no_errors: int = Field(default=0, description="Bu modeldeki hatasız test sayısı")


class ModelPromptStatistics(BaseModel):
    """Model ve Prompt kombinasyon istatistiği"""
    model_name: str = Field(description="Model adı")
    prompt_version: int = Field(description="Prompt versiyonu")
    total_tests: int = Field(description="Toplam test sayısı")
    labeled_tests: int = Field(description="Etiketlenmiş test sayısı")
    correct_tests: int = Field(description="Doğru test sayısı")
    incorrect_tests: int = Field(description="Yanlış test sayısı")
    partial_tests: int = Field(description="Kısmi doğru test sayısı")
    accuracy_rate: float = Field(description="Başarı oranı (%)")


class PromptTestStatistics(BaseModel):
    """Prompt test istatistikleri"""
    total_tests: int = Field(description="Toplam test sayısı")
    labeled_tests: int = Field(description="Etiketlenmiş test sayısı")
    correct_tests: int = Field(description="Doğru sayısı")
    incorrect_tests: int = Field(description="Yanlış sayısı")
    partial_tests: int = Field(description="Kısmi doğru sayısı")
    
    # Hata tipleri
    ocr_errors: int = Field(description="OCR hata sayısı")
    gpt_errors: int = Field(description="GPT hata sayısı")
    both_errors: int = Field(description="Her iki hata sayısı")
    no_errors: int = Field(description="Hatasız test sayısı")
    
    # Model bazlı detaylı istatistikler
    model_stats: List[ModelStatistics] = Field(description="Model bazlı detaylı istatistikler")
    
    # Model x Prompt kombinasyon istatistikleri
    model_prompt_stats: List[ModelPromptStatistics] = Field(description="Model ve Prompt kombinasyon istatistikleri")
    
    # Model bazlı (eski format - backward compatibility)
    by_model: Dict[str, Dict[str, int]] = Field(description="Model bazlı istatistikler")
    
    # Prompt versiyonu bazlı
    by_prompt_version: Dict[int, Dict[str, int]] = Field(description="Prompt versiyonu bazlı istatistikler")
    
    # Ortalamalar
    avg_ocr_confidence: float = Field(description="Ortalama OCR güven skoru")
    avg_ocr_processing_time_ms: float = Field(description="Ortalama OCR işlem süresi")
    avg_gpt_processing_time_ms: float = Field(description="Ortalama GPT işlem süresi")
    avg_gpt_cost: float = Field(description="Ortalama GPT maliyeti")


# ==================== RECEIPT DATA SCHEMAS ====================

class ReceiptCreate(BaseModel):
    """Fiş oluşturma"""
    name: str = Field(description="Fiş adı")
    description: Optional[str] = Field(default=None, description="Açıklama")
    category: Optional[str] = Field(default=None, description="Kategori")
    tags: Optional[List[str]] = Field(default=None, description="Etiketler")
    notes: Optional[str] = Field(default=None, description="Notlar")


class ReceiptUpdate(BaseModel):
    """Fiş güncelleme"""
    name: Optional[str] = Field(default=None, description="Fiş adı")
    description: Optional[str] = Field(default=None, description="Açıklama")
    category: Optional[str] = Field(default=None, description="Kategori")
    tags: Optional[List[str]] = Field(default=None, description="Etiketler")
    notes: Optional[str] = Field(default=None, description="Notlar")
    ground_truth_data: Optional[Dict[str, Any]] = Field(default=None, description="Doğru sonuç")


class ModelTestStats(BaseModel):
    """Model bazında test istatistikleri"""
    test_count: int = Field(description="Bu model ile yapılan test sayısı")
    success_count: int = Field(description="Başarılı test sayısı")
    success_rate: float = Field(description="Başarı oranı (0-100)")


class ReceiptResponse(BaseModel):
    """Fiş yanıtı"""
    id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    original_image_path: str
    cropped_image_path: Optional[str]
    is_cropped: bool
    file_hash: Optional[str]
    ground_truth_data: Optional[Dict[str, Any]]
    has_ground_truth: bool
    file_size_bytes: int
    image_width: Optional[int]
    image_height: Optional[int]
    tags: Optional[List[str]]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    test_count: int
    success_count: int
    model_stats: Optional[Dict[str, ModelTestStats]] = Field(
        default=None, 
        description="Model bazında test istatistikleri (model_name -> stats)"
    )


class ReceiptListResponse(BaseModel):
    """Fiş listesi yanıtı"""
    total: int
    receipts: List[ReceiptResponse]


class ReceiptStatistics(BaseModel):
    """Fiş istatistikleri"""
    total_receipts: int = Field(description="Toplam fiş sayısı")
    cropped_receipts: int = Field(description="Kırpılmış fiş sayısı")
    receipts_with_ground_truth: int = Field(description="Ground truth'lu fiş sayısı")
    total_tests: int = Field(description="Toplam test sayısı")
    avg_test_per_receipt: float = Field(description="Fiş başına ortalama test")
    by_category: Dict[str, int] = Field(description="Kategori bazlı dağılım")
    by_tag: Dict[str, int] = Field(description="Etiket bazlı dağılım")
