export enum OCRModelType {
  GOOGLE_DOCAI = 'google_docai',
  AMAZON_TEXTRACT = 'amazon_textract',
  PADDLE_OCR = 'paddle_ocr',
  OPENAI_VISION = 'openai_vision',
}

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export const MODEL_NAMES: Record<OCRModelType, string> = {
  [OCRModelType.OPENAI_VISION]: '🤖 OpenAI Vision (GPT-4)',
  [OCRModelType.GOOGLE_DOCAI]: '📄 Google Document AI',
  [OCRModelType.AMAZON_TEXTRACT]: '🔍 Amazon Textract',
  [OCRModelType.PADDLE_OCR]: '🐼 PaddleOCR (Ücretsiz)',
}

export interface OCRResult {
  model_name: OCRModelType
  text_content: string
  structured_data?: Record<string, any>
  confidence_score?: number
  processing_time_ms: number
  token_count?: number
  estimated_cost?: number
  error?: string
  raw_response?: Record<string, any>
}

export interface AnalysisResponse {
  analysis_id: string
  upload_timestamp: string
  file_name: string
  file_size_bytes: number
  results: OCRResult[]
  total_cost: number
  best_model?: OCRModelType
  // Kırpma bilgileri
  has_cropped_version?: boolean
  crop_area?: CropArea
  original_file_size?: number
  // Görsel yolları
  original_image_path?: string
  cropped_image_path?: string
}

export interface AnalysisHistory {
  analysis_id: string
  timestamp: string
  file_name: string
  model_count: number
  total_cost: number
  evaluated: boolean
  correct_models?: OCRModelType[]
}

export interface LineItem {
  name: string
  quantity?: number
  unit_price?: number
  total_price: number
  vat_rate?: number
  vat_amount?: number
  discount_amount?: number  // İndirim tutarı
}

export interface VATBreakdown {
  rate: number
  base_amount: number
  vat_amount: number
  total_amount: number
}

export interface AccountingData {
  vkn?: string
  company_name?: string
  plate?: string
  date?: string
  receipt_number?: string
  line_items: LineItem[]
  vat_breakdown: VATBreakdown[]  // Geriye uyumluluk için
  vat_breakdown_gpt?: VATBreakdown[]  // GPT'den gelen direkt KDV dökümü
  vat_breakdown_calculated?: VATBreakdown[]  // Ürün kalemlerinden hesaplanan KDV dökümü
  
  // Toplam değerler - Geriye uyumluluk
  subtotal?: number
  total_vat?: number
  grand_total?: number
  
  // GPT'den gelen toplamlar
  subtotal_gpt?: number
  total_vat_gpt?: number
  grand_total_gpt?: number
  
  // Hesaplanan toplamlar (ürünlerden)
  subtotal_calculated?: number
  total_vat_calculated?: number
  grand_total_calculated?: number
  
  payment_method?: string
}

export interface ModelAccountingResult {
  model_name: string
  accounting_data: AccountingData
  raw_gpt_response?: string
  processing_time_ms: number
  estimated_cost: number
  error?: string
}

export interface AccountingAnalysisResponse {
  analysis_id: string
  model_results: ModelAccountingResult[]
  total_processing_time_ms: number
  total_estimated_cost: number
}
