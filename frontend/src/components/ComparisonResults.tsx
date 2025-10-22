import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { MODEL_NAMES, AnalysisResponse, AccountingAnalysisResponse } from '@/types'
import { Clock, DollarSign, Target, ChevronDown, ChevronUp, CheckCircle, XCircle, Calculator, ZoomIn, X } from 'lucide-react'
import { getAccountingAnalysis } from '@/api/client'
import { AccountingView } from './AccountingView'
import { formatCost, formatCostTRY } from '@/lib/formatters'

interface ComparisonResultsProps {
  analysis: AnalysisResponse | null
  correctModels: Set<string>
  onToggleCorrect: (modelName: string) => void
  originalImage?: File | null
  croppedImage?: File | null
  preloadedAccountingData?: AccountingAnalysisResponse | null
}

export const ComparisonResults: React.FC<ComparisonResultsProps> = ({
  analysis,
  correctModels,
  onToggleCorrect,
  originalImage,
  croppedImage,
  preloadedAccountingData
}) => {
  // Yeni analiz geldiğinde tüm sonuçları otomatik aç
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const [accountingData, setAccountingData] = useState<AccountingAnalysisResponse | null>(null)
  const [isLoadingAccounting, setIsLoadingAccounting] = useState(false)
  const [showAccounting, setShowAccounting] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageScale, setImageScale] = useState(1)

  console.log('ComparisonResults render:', { 
    analysis, 
    correctModels,
    hasAnalysis: !!analysis,
    hasResults: analysis?.results?.length || 0,
    resultsData: analysis?.results
  })
  
  // Analiz değiştiğinde tüm model sonuçlarını otomatik aç ve muhasebe state'ini temizle
  React.useEffect(() => {
    if (analysis?.results) {
      const allModelNames = new Set(analysis.results.map(r => r.model_name))
      setExpandedResults(allModelNames)
      console.log('🔓 Tüm model sonuçları otomatik açıldı:', Array.from(allModelNames))
    }
    
    // Preloaded accounting data varsa onu kullan
    if (preloadedAccountingData) {
      console.log('💰 Preloaded accounting data kullanılıyor')
      setAccountingData(preloadedAccountingData)
      setShowAccounting(true)
    } else {
      // Yeni analiz geldiğinde muhasebe state'lerini temizle
      setAccountingData(null)
      setShowAccounting(false)
    }
  }, [analysis?.analysis_id, preloadedAccountingData])

  if (!analysis || !analysis.results || analysis.results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Analiz sonuçları burada görünecek</p>
      </div>
    )
  }

  const toggleExpanded = (modelName: string) => {
    const newExpanded = new Set(expandedResults)
    if (newExpanded.has(modelName)) {
      newExpanded.delete(modelName)
    } else {
      newExpanded.add(modelName)
    }
    setExpandedResults(newExpanded)
  }

  // Maliyet formatlama fonksiyonları formatters.ts'den import edildi

  const formatTime = (ms: number) => {
    return `${(ms / 1000).toFixed(2)} sn`
  }

  const getModelIcon = (modelName: string) => {
    switch (modelName) {
      case 'google_docai': return '📄'
      case 'amazon_textract': return '🔍'
      case 'paddle_ocr': return '🐼'
      case 'openai_vision': return '🤖'
      default: return '📄'
    }
  }

  const getBestModel = () => {
    const validResults = analysis.results.filter(r => !r.error && r.text_content.trim())
    if (validResults.length === 0) return null
    
    // En yüksek confidence score'a sahip model
    return validResults.reduce((best, current) => {
      const bestScore = best.confidence_score || 0
      const currentScore = current.confidence_score || 0
      return currentScore > bestScore ? current : best
    })
  }

  const bestModel = getBestModel()

  // Görsel URL'ini oluştur
  const imageToShow = croppedImage || originalImage
  const imageUrl = imageToShow ? URL.createObjectURL(imageToShow) : null

  // Muhasebe analizi yap
  const handleAccountingAnalysis = async () => {
    if (!analysis) return
    
    setIsLoadingAccounting(true)
    try {
      const result = await getAccountingAnalysis(analysis.analysis_id)
      setAccountingData(result)
      setShowAccounting(true)
    } catch (error) {
      console.error('Muhasebe analizi hatası:', error)
      alert('Muhasebe analizi sırasında bir hata oluştu.')
    } finally {
      setIsLoadingAccounting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Analiz Edilen Görsel */}
      {imageUrl && (
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                📸 Analiz Edilen Görsel
                {croppedImage && <span className="text-sm text-blue-600">(Kırpılmış)</span>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImageModal(true)}
                className="flex items-center gap-2"
              >
                <ZoomIn className="w-4 h-4" />
                Büyüt
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="flex justify-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowImageModal(true)}
            >
              <img 
                src={imageUrl} 
                alt="Analiz edilen fiş" 
                className="max-w-full max-h-96 object-contain border rounded-lg shadow-sm"
              />
            </div>
            <div className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
              <p>Dosya: {analysis.file_name}</p>
              <p>Boyut: {(analysis.file_size_bytes / 1024).toFixed(1)} KB</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">💡 Görsele tıklayarak büyütebilirsiniz</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Özet Bilgiler */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Analiz Özeti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analysis.results.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Model</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCostTRY(analysis.total_cost)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Toplam Maliyet</div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ({formatCost(analysis.total_cost)})
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {(analysis.results.reduce((sum, r) => sum + r.processing_time_ms, 0) / analysis.results.length / 1000).toFixed(2)} sn
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ort. Süre</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {correctModels.size}/{analysis.results.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Doğru Model</div>
            </div>
          </div>
          
          {bestModel && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600">🏆</span>
                <span className="font-medium">En İyi Model:</span>
                <span className="text-blue-600 font-semibold">
                  {MODEL_NAMES[bestModel.model_name]}
                </span>
                <span className="text-sm text-gray-600">
                  ({Math.round((bestModel.confidence_score || 0) * 100)}% güven)
                </span>
              </div>
            </div>
          )}

          {/* Muhasebe Analizi Butonu */}
          <div className="mt-6 flex justify-center">
            <Button 
              onClick={handleAccountingAnalysis}
              disabled={isLoadingAccounting}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-6 text-lg"
            >
              <Calculator className="w-5 h-5 mr-2" />
              {isLoadingAccounting ? 'Muhasebe Verisi Hazırlanıyor...' : '💰 Muhasebe Verisi Çıkar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Muhasebe Görünümü - Her Model İçin Ayrı */}
      {showAccounting && accountingData && accountingData.model_results && (
        <div className="space-y-4">
          <div className="text-center py-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 rounded-lg border-2 border-green-300 dark:border-green-800">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-3">
              <Calculator className="w-8 h-8 text-green-600 dark:text-green-400" />
              💰 Muhasebe Verisi Karşılaştırması
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Her modelin OCR çıktısından GPT-4o-mini ile çıkarılan muhasebe verileri
            </p>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Toplam Süre: {(accountingData.total_processing_time_ms / 1000).toFixed(2)} sn • 
              Toplam Maliyet: {formatCostTRY(accountingData.total_estimated_cost)}
            </div>
          </div>

          {accountingData.model_results.map((modelResult) => (
            <Card 
              key={modelResult.model_name} 
              className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 border-2 border-green-300 dark:border-green-800"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <span>{getModelIcon(modelResult.model_name)}</span>
                  <span>{MODEL_NAMES[modelResult.model_name as keyof typeof MODEL_NAMES]}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">- Muhasebe Verisi</span>
                </CardTitle>
                {modelResult.error && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    ⚠️ Hata: {modelResult.error}
                  </p>
                )}
                {!modelResult.error && (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    İşlem Süresi: {(modelResult.processing_time_ms / 1000).toFixed(2)} sn • 
                    Maliyet: {formatCostTRY(modelResult.estimated_cost)}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {!modelResult.error ? (
                  <AccountingView 
                    data={modelResult.accounting_data}
                    processingTime={modelResult.processing_time_ms}
                    ocrProcessingTime={analysis.results.find(r => r.model_name === modelResult.model_name)?.processing_time_ms}
                    cost={modelResult.estimated_cost}
                    rawGptResponse={modelResult.raw_gpt_response}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Bu model için muhasebe verisi çıkarılamadı</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Modal - Büyüteç */}
      {showImageModal && imageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-7xl max-h-screen" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 z-10 bg-white hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </Button>
            
            {/* Zoom Controls */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImageScale(Math.max(0.5, imageScale - 0.25))}
                className="bg-white hover:bg-gray-100"
              >
                −
              </Button>
              <div className="bg-white px-3 py-1 rounded text-sm font-semibold">
                {Math.round(imageScale * 100)}%
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImageScale(Math.min(3, imageScale + 0.25))}
                className="bg-white hover:bg-gray-100"
              >
                +
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImageScale(1)}
                className="bg-white hover:bg-gray-100"
              >
                Reset
              </Button>
            </div>

            {/* Image */}
            <div className="overflow-auto max-h-[90vh] max-w-[90vw] bg-gray-100 rounded-lg p-4">
              <img
                src={imageUrl}
                alt="Fiş büyütülmüş görünüm"
                className="cursor-move"
                style={{
                  width: `${imageScale * 100}%`,
                  height: 'auto',
                  transition: 'width 0.2s ease-in-out'
                }}
              />
            </div>
            
            <div className="text-center mt-4 text-white text-sm">
              <p>📸 {analysis.file_name}</p>
              <p className="text-xs text-gray-300 mt-1">
                + / − butonları ile yakınlaştır/uzaklaştır • ESC veya dışarı tıkla ile kapat
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Model Sonuçları - Yan Yana Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          🤖 Model Karşılaştırması
          <span className="text-sm text-gray-500 dark:text-gray-400">({analysis.results.length} model)</span>
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {analysis.results.map((result) => {
            const isCorrect = correctModels.has(result.model_name)
            const isExpanded = expandedResults.has(result.model_name)
            const modelName = MODEL_NAMES[result.model_name] || result.model_name
            const hasError = !!result.error
            const hasContent = result.text_content.trim().length > 0

            return (
              <Card 
                key={result.model_name} 
                className={`transition-all duration-200 ${
                  isCorrect ? 'border-green-500 border-2 bg-green-50 dark:bg-green-950' : 
                  hasError ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950' : 
                  'hover:shadow-md'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getModelIcon(result.model_name)}</span>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {modelName}
                          {hasError && <XCircle className="w-4 h-4 text-red-500" />}
                          {isCorrect && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(result.processing_time_ms)}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatCost(result.estimated_cost)}
                          </span>
                          {result.confidence_score && (
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {Math.round(result.confidence_score * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`correct-${result.model_name}`}
                          checked={isCorrect}
                          onCheckedChange={() => onToggleCorrect(result.model_name)}
                        />
                        <label 
                          htmlFor={`correct-${result.model_name}`}
                          className="text-sm font-medium cursor-pointer select-none"
                        >
                          Doğru
                        </label>
                      </div>
                      
                      {hasContent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(result.model_name)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                {(hasError || (hasContent && isExpanded)) && (
                  <CardContent>
                    {hasError ? (
                      <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300">
                        <strong>Hata:</strong> {result.error}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Çıkarılan Metin:</h4>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {result.text_content || 'Metin bulunamadı'}
                          </div>
                        </div>
                        
                        {result.structured_data && Object.keys(result.structured_data).length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Yapılandırılmış Veri:</h4>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
                              <pre className="whitespace-pre-wrap text-xs text-gray-900 dark:text-gray-100">
                                {JSON.stringify(result.structured_data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
