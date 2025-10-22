import axios from 'axios'
import { AnalysisResponse, AnalysisHistory, OCRModelType, AccountingAnalysisResponse } from '@/types'

// Production'da environment variable kullan, development'ta proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || ''  // Vercel'de VITE_API_URL set edilecek

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 180 saniye timeout (muhasebe analizi uzun sürebilir)
})

// Request interceptor - istekleri logla
api.interceptors.request.use(
  (config) => {
    console.log('🚀 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      headers: config.headers,
      data: config.data
    })
    return config
  },
  (error) => {
    console.error('❌ Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor - yanıtları logla
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      data: response.data
    })
    return response
  },
  (error) => {
    console.error('❌ API Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      data: error.response?.data
    })
    return Promise.reject(error)
  }
)

export const analyzeReceipt = async (
  file: File,
  prompt?: string,
  models?: OCRModelType[]
): Promise<AnalysisResponse> => {
  console.log('🚀 API ÇAĞRISI BAŞLADI - analyzeReceipt')
  console.log('📋 İstek parametreleri:', { 
    fileName: file.name, 
    fileSize: file.size, 
    fileType: file.type,
    prompt: prompt || 'Boş', 
    models: models || 'Varsayılan',
    modelsCount: models?.length || 0
  })
  
  const formData = new FormData()
  formData.append('file', file)
  
  if (prompt) {
    formData.append('prompt', prompt)
  }
  
  if (models && models.length > 0) {
    console.log('📝 Modeller FormData\'ya ekleniyor:', models.join(','))
    formData.append('models', models.join(','))
  }
  
  console.log('📤 FormData hazırlandı, POST isteği gönderiliyor...')
  
  try {
    const response = await api.post<AnalysisResponse>('/api/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    console.log('✅ API YANITI BAŞARILI!')
    console.log('📊 Yanıt detayları:', {
      status: response.status,
      statusText: response.statusText,
      analysisId: response.data?.analysis_id,
      fileName: response.data?.file_name,
      resultCount: response.data?.results?.length || 0,
      totalCost: response.data?.total_cost,
      hasResults: (response.data?.results?.length || 0) > 0
    })
    
    if (response.data?.results && response.data.results.length > 0) {
      console.log('🎯 Model sonuçları:', response.data.results.map(r => ({
        model: r.model_name,
        hasText: !!r.text_content,
        textLength: r.text_content?.length || 0,
        cost: r.estimated_cost || 0,
        processingTime: r.processing_time_ms,
        hasError: !!r.error
      })))
    } else {
      console.warn('⚠️ Hiç sonuç bulunamadı!')
    }
    
    return response.data
  } catch (error) {
    console.error('❌ API HATASI:', error)
    throw error
  }
}

export const evaluateAnalysis = async (
  analysisId: string,
  correctModels: OCRModelType[],
  notes?: string,
  groundTruth?: string
): Promise<void> => {
  await api.post(`/api/evaluate/${analysisId}`, {
    analysis_id: analysisId,
    correct_models: correctModels,
    notes,
    ground_truth: groundTruth,
  })
}

export const getHistory = async (limit = 50): Promise<AnalysisHistory[]> => {
  const response = await api.get<AnalysisHistory[]>('/api/history', {
    params: { limit },
  })
  
  return response.data
}

export const getAnalysis = async (analysisId: string): Promise<AnalysisResponse> => {
  const response = await api.get<AnalysisResponse>(`/api/analysis/${analysisId}`)
  return response.data
}

export const healthCheck = async (): Promise<any> => {
  const response = await api.get('/api/health')
  return response.data
}

export const getAccountingAnalysis = async (
  analysisId: string,
  gptModel: string = 'gpt-4o-mini'
): Promise<AccountingAnalysisResponse> => {
  console.log('💰 Muhasebe analizi başlatılıyor:', analysisId, 'Model:', gptModel)
  try {
    const formData = new FormData()
    formData.append('gpt_model', gptModel)
    
    const response = await api.post<AccountingAnalysisResponse>(
      `/api/accounting-analysis/${analysisId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    console.log('✅ Muhasebe analizi tamamlandı:', response.data)
    return response.data
  } catch (error: any) {
    console.error('❌ Muhasebe analizi API hatası:', error)
    console.error('Response:', error.response?.data)
    console.error('Status:', error.response?.status)
    throw new Error(error.response?.data?.detail || error.message || 'Muhasebe analizi başarısız')
  }
}

// Prompt yönetimi
export interface PromptData {
  version: number
  created_at: string
  prompt: string
  previous_version?: number
  restored_from_version?: number
  token_count?: number
}

export const getAllPrompts = async (): Promise<Record<string, PromptData>> => {
  const response = await api.get<Record<string, PromptData>>('/api/prompts')
  return response.data
}

export const getModelPrompt = async (modelName: string): Promise<PromptData> => {
  const response = await api.get<PromptData>(`/api/prompts/${modelName}`)
  return response.data
}

export const saveModelPrompt = async (modelName: string, prompt: string): Promise<{ success: boolean; message: string; data: PromptData }> => {
  const formData = new FormData()
  formData.append('prompt', prompt)
  
  const response = await api.post(`/api/prompts/${modelName}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const getPromptHistory = async (modelName: string): Promise<PromptData[]> => {
  const response = await api.get<PromptData[]>(`/api/prompts/${modelName}/history`)
  return response.data
}

export const getPromptVersion = async (modelName: string, version: number): Promise<PromptData> => {
  const response = await api.get<PromptData>(`/api/prompts/${modelName}/version/${version}`)
  return response.data
}

export const restorePromptVersion = async (modelName: string, version: number): Promise<{ success: boolean; message: string; data: PromptData }> => {
  const response = await api.post(`/api/prompts/${modelName}/restore/${version}`)
  return response.data
}

export const deletePromptVersion = async (modelName: string, version: number): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/api/prompts/${modelName}/version/${version}`)
  return response.data
}

// ==================== PROMPT TEST API ====================

export interface PromptTestResponse {
  id: string
  model_name: string
  prompt_version: number
  original_image_path: string
  cropped_image_path?: string
  ocr_text?: string
  ocr_confidence?: number
  gpt_model?: string
  accounting_data?: any
  label?: string
  error_type?: string
  error_details?: any
  user_notes?: string
  tags?: string[]
  created_at: string
  labeled_at?: string
}

export interface ModelStats {
  model_name: string
  total_tests: number
  labeled_tests: number
  correct_tests: number
  incorrect_tests: number
  partial_tests: number
  avg_processing_time_ms: number
  avg_ocr_cost: number
  avg_gpt_cost: number
  ocr_errors: number
  gpt_errors: number
  both_errors: number
  no_errors: number
}

export interface ModelPromptStats {
  model_name: string
  prompt_version: number
  total_tests: number
  labeled_tests: number
  correct_tests: number
  incorrect_tests: number
  partial_tests: number
  accuracy_rate: number
}

export interface PromptTestStatistics {
  total_tests: number
  labeled_tests: number
  correct_tests: number
  incorrect_tests: number
  partial_tests: number
  ocr_errors: number
  gpt_errors: number
  both_errors: number
  no_errors: number
  model_stats: ModelStats[]
  model_prompt_stats: ModelPromptStats[]
  by_model: Record<string, Record<string, number>>
  by_prompt_version: Record<number, Record<string, number>>
  avg_ocr_confidence: number
  avg_ocr_processing_time_ms: number
  avg_gpt_processing_time_ms: number
  avg_gpt_cost: number
}

export const createPromptTest = async (
  file: File,
  modelName: string,
  promptVersion: number,
  gptPromptUsed: string,
  gptModel?: string,
  ocrText?: string,
  ocrConfidence?: number,
  ocrProcessingTimeMs?: number,
  ocrCost?: number,
  gptResponseRaw?: string,
  accountingData?: any,
  gptProcessingTimeMs?: number,
  gptCost?: number,
  cropped = false,
  receiptId?: string
): Promise<PromptTestResponse> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model_name', modelName)
  formData.append('prompt_version', promptVersion.toString())
  formData.append('gpt_prompt_used', gptPromptUsed)
  formData.append('cropped', cropped.toString())
  
  if (gptModel) formData.append('gpt_model', gptModel)
  if (ocrText) formData.append('ocr_text', ocrText)
  if (ocrConfidence !== undefined) formData.append('ocr_confidence', ocrConfidence.toString())
  if (ocrProcessingTimeMs !== undefined) formData.append('ocr_processing_time_ms', ocrProcessingTimeMs.toString())
  if (ocrCost !== undefined) formData.append('ocr_cost', ocrCost.toString())
  if (gptResponseRaw) formData.append('gpt_response_raw', gptResponseRaw)
  if (accountingData) formData.append('accounting_data_json', JSON.stringify(accountingData))
  if (gptProcessingTimeMs !== undefined) formData.append('gpt_processing_time_ms', gptProcessingTimeMs.toString())
  if (gptCost !== undefined) formData.append('gpt_cost', gptCost.toString())
  if (receiptId) formData.append('receipt_id', receiptId)
  
  const response = await api.post<PromptTestResponse>('/api/prompt-tests', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

export const labelPromptTest = async (
  testId: string,
  label: string,
  errorType?: string,
  errorDetails?: any,
  expectedOutput?: any,
  userNotes?: string,
  tags?: string[]
): Promise<void> => {
  await api.patch(`/api/prompt-tests/${testId}/label`, {
    label,
    error_type: errorType,
    error_details: errorDetails,
    expected_output: expectedOutput,
    user_notes: userNotes,
    tags
  })
}

export const getPromptTests = async (
  modelName?: string,
  labeledOnly = false,
  limit = 50,
  offset = 0
): Promise<PromptTestResponse[]> => {
  const response = await api.get<PromptTestResponse[]>('/api/prompt-tests', {
    params: { model_name: modelName, labeled_only: labeledOnly, limit, offset }
  })
  return response.data
}

export const getPromptTestStatistics = async (
  modelName?: string
): Promise<PromptTestStatistics> => {
  const response = await api.get<PromptTestStatistics>('/api/prompt-tests/statistics', {
    params: { model_name: modelName }
  })
  return response.data
}

export const getPromptTest = async (testId: string): Promise<PromptTestResponse> => {
  const response = await api.get<PromptTestResponse>(`/api/prompt-tests/${testId}`)
  return response.data
}

// ==================== RECEIPT DATA API ====================

export interface ModelTestStats {
  test_count: number
  success_count: number
  success_rate: number
}

export interface ReceiptResponse {
  id: string
  name: string
  description?: string
  category?: string
  original_image_path: string
  cropped_image_path?: string
  is_cropped: boolean
  ground_truth_data?: any
  has_ground_truth: boolean
  file_size_bytes: number
  image_width?: number
  image_height?: number
  tags?: string[]
  notes?: string
  created_at: string
  updated_at: string
  test_count: number
  success_count: number
  model_stats?: Record<string, ModelTestStats>
}

export interface ReceiptListResponse {
  total: number
  receipts: ReceiptResponse[]
}

export interface ReceiptStatistics {
  total_receipts: number
  cropped_receipts: number
  receipts_with_ground_truth: number
  total_tests: number
  avg_test_per_receipt: number
  by_category: Record<string, number>
  by_tag: Record<string, number>
}

export const uploadReceipts = async (
  files: File[],
  options?: {
    names?: string[]
    category?: string
    tags?: string[]
    notes?: string
  }
): Promise<ReceiptResponse[]> => {
  const formData = new FormData()
  
  files.forEach(file => {
    formData.append('files', file)
  })
  
  if (options?.names) {
    formData.append('names', JSON.stringify(options.names))
  }
  if (options?.category) {
    formData.append('category', options.category)
  }
  if (options?.tags) {
    formData.append('tags', JSON.stringify(options.tags))
  }
  if (options?.notes) {
    formData.append('notes', options.notes)
  }
  
  const response = await api.post<ReceiptResponse[]>('/api/receipts/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

export const getReceipts = async (
  options?: {
    category?: string
    has_ground_truth?: boolean
    limit?: number
    offset?: number
    include_model_stats?: boolean
  }
): Promise<ReceiptListResponse> => {
  const response = await api.get<ReceiptListResponse>('/api/receipts', {
    params: options
  })
  return response.data
}

export const getReceipt = async (receiptId: string): Promise<ReceiptResponse> => {
  const response = await api.get<ReceiptResponse>(`/api/receipts/${receiptId}`)
  return response.data
}

export const cropReceipt = async (
  receiptId: string,
  croppedFile: File
): Promise<ReceiptResponse> => {
  const formData = new FormData()
  formData.append('file', croppedFile)
  
  const response = await api.post<ReceiptResponse>(
    `/api/receipts/${receiptId}/crop`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return response.data
}

export const updateReceipt = async (
  receiptId: string,
  update: {
    name?: string
    description?: string
    category?: string
    tags?: string[]
    notes?: string
    ground_truth_data?: any
  }
): Promise<ReceiptResponse> => {
  const response = await api.patch<ReceiptResponse>(
    `/api/receipts/${receiptId}`,
    update
  )
  return response.data
}

export const deleteReceipt = async (receiptId: string): Promise<void> => {
  await api.delete(`/api/receipts/${receiptId}`)
}

export const getReceiptStatistics = async (): Promise<ReceiptStatistics> => {
  const response = await api.get<ReceiptStatistics>('/api/receipts/statistics/summary')
  return response.data
}

// ==================== PROMPT VERSIONS API ====================

export interface PromptVersionsResponse {
  model_name: string
  versions: number[]
  current_version: number
}

export const getPromptVersions = async (
  modelName: string
): Promise<PromptVersionsResponse> => {
  const response = await api.get<PromptVersionsResponse>(
    `/api/prompt-versions/${modelName}`
  )
  return response.data
}
