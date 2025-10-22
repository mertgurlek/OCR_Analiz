import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { analyzeReceipt, getAccountingAnalysis, getModelPrompt, saveModelPrompt, PromptData, createPromptTest, labelPromptTest, ReceiptResponse, getPromptHistory, restorePromptVersion, deletePromptVersion } from '@/api/client'
import { OCRModelType, AnalysisResponse, AccountingAnalysisResponse, MODEL_NAMES } from '@/types'
import { Upload, Loader2, Calculator, FileText, Clock, DollarSign, Save, AlertCircle, Crop, Tag, CheckCircle, XCircle, AlertTriangle, Database, FileImage, ZoomIn, X } from 'lucide-react'
import { ImageCropper } from './ImageCropper'
import { ReceiptSelector } from './ReceiptSelector'
import { AccountingView } from './AccountingView'
import { formatCost } from '@/lib/formatters'
import { parseTags } from '@/lib/utils'
import { useFileUpload, useImageModal, useLoadingState } from '@/hooks'

interface SingleModelTestProps {
  modelType: OCRModelType
  modelIcon: string
}

export const SingleModelTest: React.FC<SingleModelTestProps> = ({ modelType, modelIcon }) => {
  // Custom hooks - state management
  const fileState = useFileUpload()
  const imageModal = useImageModal()
  const loading = useLoadingState()
  
  // Component-specific state
  const [ocrResult, setOcrResult] = useState<AnalysisResponse | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [defaultPrompt, setDefaultPrompt] = useState<PromptData | null>(null)
  const [accountingData, setAccountingData] = useState<AccountingAnalysisResponse | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [savedTestId, setSavedTestId] = useState<string | null>(null)
  const [showReceiptSelector, setShowReceiptSelector] = useState(false)
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)
  const [selectedGptModel, setSelectedGptModel] = useState<string>('gpt-4o-mini')
  const [promptHistory, setPromptHistory] = useState<PromptData[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)

  // Prompt ve geçmişi yükle
  useEffect(() => {
    const loadPrompt = async () => {
      loading.setLoading('loadingPrompt', true)
      try {
        const promptData = await getModelPrompt(modelType)
        setDefaultPrompt(promptData)
        setCustomPrompt(promptData.prompt)
        setSelectedVersion(promptData.version)
        setHasUnsavedChanges(false)
        
        // Geçmişi de yükle
        await loadHistory()
      } catch (error) {
        console.error('Prompt yükleme hatası:', error)
      } finally {
        loading.setLoading('loadingPrompt', false)
      }
    }
    
    loadPrompt()
  }, [modelType])
  
  const loadHistory = async () => {
    loading.setLoading('loadingHistory', true)
    try {
      const history = await getPromptHistory(modelType)
      setPromptHistory(history)
    } catch (error) {
      console.error('Geçmiş yükleme hatası:', error)
    } finally {
      loading.setLoading('loadingHistory', false)
    }
  }

  // Prompt değişikliğini kontrol et
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomPrompt(e.target.value)
    setHasUnsavedChanges(e.target.value !== defaultPrompt?.prompt)
  }

  // Prompt'u kaydet
  const handleSavePrompt = async () => {
    loading.setLoading('savingPrompt', true)
    try {
      const result = await saveModelPrompt(modelType, customPrompt)
      setDefaultPrompt(result.data)
      setSelectedVersion(result.data.version)
      setHasUnsavedChanges(false)
      await loadHistory() // Geçmişi yeniden yükle
      alert(`✅ ${result.message}`)
    } catch (error) {
      console.error('Prompt kaydetme hatası:', error)
      alert('❌ Prompt kaydedilirken hata oluştu.')
    } finally {
      loading.setLoading('savingPrompt', false)
    }
  }
  
  // Versiyon değiştir
  const handleVersionChange = async (version: number) => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('Kaydedilmemiş değişiklikler var. Yine de versiyon değiştirmek istiyor musunuz?')
      if (!confirm) return
    }
    
    loading.setLoading('loadingPrompt', true)
    try {
      const versionData = await getPromptHistory(modelType)
      const targetVersion = versionData.find(v => v.version === version)
      if (targetVersion) {
        setCustomPrompt(targetVersion.prompt)
        setSelectedVersion(version)
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error('Versiyon yükleme hatası:', error)
      alert('❌ Versiyon yüklenemedi.')
    } finally {
      loading.setLoading('loadingPrompt', false)
    }
  }
  
  // Versiyonu geri yükle (mevcut versiyon yap)
  const handleRestoreVersion = async (version: number) => {
    const confirm = window.confirm(`Version ${version} mevcut versiyon olarak geri yüklenecek. Emin misiniz?`)
    if (!confirm) return
    
    try {
      const result = await restorePromptVersion(modelType, version)
      alert(`✅ ${result.message}`)
      
      // Sayfayı yenile
      const promptData = await getModelPrompt(modelType)
      setDefaultPrompt(promptData)
      setCustomPrompt(promptData.prompt)
      setSelectedVersion(promptData.version)
      setHasUnsavedChanges(false)
      await loadHistory()
    } catch (error) {
      console.error('Versiyon geri yükleme hatası:', error)
      alert('❌ Versiyon geri yüklenemedi.')
    }
  }
  
  // Versiyonu sil
  const handleDeleteVersion = async (version: number) => {
    const confirm = window.confirm(`Version ${version} silinecek. Bu işlem geri alınamaz. Emin misiniz?`)
    if (!confirm) return
    
    try {
      const result = await deletePromptVersion(modelType, version)
      alert(`✅ ${result.message}`)
      await loadHistory()
    } catch (error: any) {
      console.error('Versiyon silme hatası:', error)
      alert(`❌ ${error.response?.data?.detail || 'Versiyon silinemedi.'}`)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      fileState.selectFile(file)
      setOcrResult(null)
      setAccountingData(null)
    }
  }

  const handleCropComplete = (originalImage: File, croppedImage: File, cropArea: any) => {
    console.log('🎯 Kırpma tamamlandı:', {
      original: originalImage.name,
      cropped: croppedImage.name,
      cropArea
    })
    fileState.cropFile(croppedImage)
    alert('✅ Görsel kırpıldı! Şimdi analiz yapabilirsiniz.')
  }

  const handleAnalyze = async () => {
    if (!fileState.selectedFile) return

    loading.setLoading('analyzing', true)
    setOcrResult(null)
    setAccountingData(null)

    try {
      const fileToAnalyze = fileState.croppedFile || fileState.selectedFile
      const result = await analyzeReceipt(
        fileToAnalyze,
        customPrompt || undefined,
        [modelType]
      )
      setOcrResult(result)
      console.log('📊 OCR Sonucu:', result)
      console.log('🔍 Analysis ID:', result.analysis_id)
      loading.setLoading('analyzing', false) // OCR bitti, UI'yi güncelle
      
      // OCR tamamlandı - otomatik muhasebe analizi başlat
      if (result.analysis_id) {
        console.log('✅ Analysis ID mevcut, muhasebe analizi başlatılıyor...')
        await handleAccountingAnalysis(result.analysis_id, selectedGptModel)
      } else {
        console.warn('⚠️ Analysis ID bulunamadı, muhasebe analizi yapılamıyor')
        alert('⚠️ Analysis ID bulunamadı. Backend response kontrol edin.')
      }
    } catch (error) {
      console.error('Analiz hatası:', error)
      alert('Analiz sırasında bir hata oluştu.')
      loading.setLoading('analyzing', false)
    }
  }

  const handleAccountingAnalysis = async (analysisId: string, gptModel: string) => {
    console.log('💰 Muhasebe analizi başlatılıyor:', analysisId, 'Model:', gptModel)
    loading.setLoading('loadingAccounting', true)
    try {
      const accountingResult = await getAccountingAnalysis(analysisId, gptModel)
      console.log('✅ Muhasebe analizi tamamlandı:', accountingResult)
      setAccountingData(accountingResult)
    } catch (error) {
      console.error('❌ Muhasebe analizi hatası:', error)
      alert(`⚠️ Muhasebe analizi başarısız: ${(error as Error).message}\n\nDetaylar Console'da (F12).`)
    } finally {
      loading.setLoading('loadingAccounting', false)
    }
  }

  const handleReceiptSelect = async (receipt: ReceiptResponse, version: 'original' | 'cropped') => {
    try {
      // Fiş seçildi - ID'yi sakla
      setSelectedReceiptId(receipt.id)
      setShowReceiptSelector(false)
      
      // Görsel path'ini belirle
      const imagePath = version === 'cropped' && receipt.cropped_image_path 
        ? receipt.cropped_image_path 
        : receipt.original_image_path
      
      // Görseli yükle
      const response = await fetch(imagePath)
      const blob = await response.blob()
      const file = new File([blob], `${receipt.name}.jpg`, { type: blob.type })
      fileState.selectFile(file)
      
      // Kullanıcıya bildir
      alert(`✅ Fiş seçildi: ${receipt.name} (${version})\n\nGörsel yüklendi. Şimdi "OCR Analizi Yap" butonuna tıklayabilirsiniz.`)
    } catch (error) {
      console.error('Fiş yükleme hatası:', error)
      alert('❌ Fiş yüklenemedi. Lütfen tekrar deneyin.')
    }
  }

  const handleSaveTest = async () => {
    if (!accountingResult || !defaultPrompt || !result) return

    loading.setLoading('savingTest', true)
    try {
      const fileToSave = fileState.croppedFile || fileState.selectedFile!
      const response = await createPromptTest(
        fileToSave,                                  // file
        modelType,                                    // modelName
        defaultPrompt.version,                        // promptVersion
        defaultPrompt.prompt,                         // gptPromptUsed (prompt metni)
        selectedGptModel,                             // gptModel (gpt-4o-mini)
        result.text_content,                          // ocrText
        result.confidence_score,                      // ocrConfidence
        result.processing_time_ms,                    // ocrProcessingTimeMs
        result.estimated_cost,                        // ocrCost
        accountingResult.raw_gpt_response,            // gptResponseRaw
        accountingResult.accounting_data,             // accountingData
        accountingResult.processing_time_ms,          // gptProcessingTimeMs
        accountingResult.estimated_cost,              // gptCost
        !!fileState.croppedFile,                      // cropped
        selectedReceiptId || undefined                // receiptId
      )
      setSavedTestId(response.id)
      setShowLabelModal(true)
    } catch (error) {
      console.error('Test kaydetme hatası:', error)
      alert('❌ Test kaydedilemedi: ' + (error as Error).message)
    } finally {
      loading.setLoading('savingTest', false)
    }
  }

  const result = ocrResult?.results?.[0]
  const accountingResult = accountingData?.model_results?.[0]

  return (
    <div className="space-y-6">
      {/* Model Başlık */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="text-3xl">{modelIcon}</span>
            <span>{MODEL_NAMES[modelType]}</span>
            <span className="text-sm text-muted-foreground font-normal">- Tekli Test Alanı</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Bu alanda sadece {MODEL_NAMES[modelType]} modelini test edebilir ve prompt'unu optimize edebilirsiniz
          </p>
        </CardHeader>
      </Card>

      {/* Muhasebe Analiz Prompt'u */}
      <Card className={hasUnsavedChanges ? 'border-orange-300 border-2' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Muhasebe Analiz Prompt'u
              {defaultPrompt && (
                <span className="text-sm font-normal text-muted-foreground">
                  (v{defaultPrompt.version})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">Kaydedilmemiş değişiklik</span>
                </div>
              )}
              <Button
                onClick={handleSavePrompt}
                disabled={loading.savingPrompt || !hasUnsavedChanges}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {loading.savingPrompt ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {loading.savingPrompt ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading.loadingPrompt ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Prompt yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* Model Seçici Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* GPT Model Seçici */}
                <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <label className="block text-sm font-semibold mb-2">
                    🤖 Muhasebe Analizi için GPT Modeli
                  </label>
                  <select
                    value={selectedGptModel}
                    onChange={(e) => setSelectedGptModel(e.target.value)}
                    className="w-full p-2 border border-purple-300 dark:border-purple-700 rounded-md bg-background font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="gpt-4o-mini">GPT-4o-mini ($0.15/$0.60 per 1M tokens)</option>
                    <option value="gpt-4.1-mini">GPT-4.1-mini ($0.10/$0.40 per 1M tokens)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-2">
                    💰 Seçili model, maliyet hesaplamasını ve muhasebe çıktısını etkiler
                  </p>
                </div>

                {/* Versiyon Seçici */}
                <div className="p-3 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950 dark:to-teal-950 rounded-lg border border-green-200 dark:border-green-800">
                  <label className="block text-sm font-semibold mb-2">
                    📋 Prompt Versiyonu
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedVersion || ''}
                      onChange={(e) => handleVersionChange(Number(e.target.value))}
                      className="flex-1 p-2 border border-green-300 dark:border-green-700 rounded-md bg-background font-semibold focus:ring-2 focus:ring-green-500 focus:outline-none"
                      disabled={loading.loadingHistory || promptHistory.length === 0}
                    >
                      {promptHistory.length > 0 ? (
                        promptHistory.map(v => (
                          <option key={v.version} value={v.version}>
                            v{v.version} {v.version === defaultPrompt?.version ? '(Mevcut)' : ''}
                            {v.restored_from_version ? ` (v${v.restored_from_version}'den)` : ''}
                          </option>
                        ))
                      ) : (
                        <option value="">Yükleniyor...</option>
                      )}
                    </select>
                    {selectedVersion && selectedVersion !== defaultPrompt?.version && (
                      <Button
                        onClick={() => handleRestoreVersion(selectedVersion)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                        title="Bu versiyonu mevcut versiyon yap"
                      >
                        Geri Yükle
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    🔄 Eski versiyonlara dönebilir ve görüntüleyebilirsiniz
                  </p>
                </div>
              </div>

              <textarea
                value={customPrompt}
                onChange={handlePromptChange}
                placeholder="Muhasebe analizi için kullanılacak prompt..."
                className="min-h-[200px] font-mono text-sm w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  💡 Bu prompt {selectedGptModel} modeline gönderilir ve muhasebe verisi çıkarılır
                </span>
                {defaultPrompt && (
                  <div className="flex flex-col items-end gap-1">
                    <span>
                      Son güncelleme: {new Date(defaultPrompt.created_at).toLocaleString('tr-TR')}
                    </span>
                    {defaultPrompt.token_count && (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        📊 {defaultPrompt.token_count.toLocaleString('tr-TR')} token
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* File Upload & Analyze */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Fiş Yükle ve Analiz Et
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Datadan Seç VEYA Manuel Yükle */}
          <div className="flex gap-3 items-center bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <Button
              onClick={() => setShowReceiptSelector(true)}
              variant="outline"
              className="flex-1 bg-card hover:bg-secondary border-blue-300 dark:border-blue-700"
            >
              <Database className="w-4 h-4 mr-2" />
              📚 Datadan Seç
            </Button>
            <div className="text-sm text-muted-foreground font-semibold">VEYA</div>
            <div className="flex-1 text-center text-sm text-muted-foreground">
              👇 Manuel Yükle
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                onChange={handleFileSelect}
                accept="image/*"
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {fileState.selectedFile && !fileState.croppedFile && (
                <Button
                  onClick={() => fileState.setShowCropper(true)}
                  variant="outline"
                  className="whitespace-nowrap"
                >
                  <Crop className="w-4 h-4 mr-2" />
                  Kırp
                </Button>
              )}
              <Button
                onClick={handleAnalyze}
                disabled={!fileState.selectedFile || loading.analyzing}
                className="whitespace-nowrap"
              >
                {loading.analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analiz Ediliyor...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    OCR Analizi Yap
                  </>
                )}
              </Button>
            </div>
            {fileState.selectedFile && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  📁 Seçili: {fileState.selectedFile.name} ({(fileState.selectedFile.size / 1024).toFixed(1)} KB)
                </p>
                {fileState.croppedFile && (
                  <p className="text-sm text-green-600">
                    ✂️ Kırpılmış: {fileState.croppedFile.name} ({(fileState.croppedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OCR Result */}
      {result && (
        <Card className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 border-2 border-green-300 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>{modelIcon}</span>
                <span>OCR Sonucu</span>
              </span>
              <div className="flex items-center gap-4 text-sm font-normal">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {result.processing_time_ms.toFixed(0)}ms
                </span>
                <span className="flex items-center gap-1 text-green-600">
                  <DollarSign className="w-4 h-4" />
                  {formatCost(result.estimated_cost)}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-semibold">❌ Hata:</p>
                <p className="text-red-600 text-sm mt-1">{result.error}</p>
              </div>
            ) : (
              <>
                <div>
                  <h4 className="font-semibold mb-2">Çıkarılan Metin:</h4>
                  <div className="bg-card p-4 rounded border max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-mono text-sm">{result.text_content}</pre>
                  </div>
                </div>

                {result.confidence_score !== undefined && (
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm">
                      <span className="font-semibold">Güven Skoru:</span>{' '}
                      <span className="text-blue-700">{(result.confidence_score * 100).toFixed(1)}%</span>
                    </p>
                  </div>
                )}

                {/* Muhasebe Analizi Durumu */}
                {loading.loadingAccounting && (
                  <div className="pt-4 border-t flex items-center justify-center py-6 text-blue-600">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    <span>Muhasebe verisi otomatik çıkarılıyor...</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Accounting Data */}
      {accountingResult && (
        <Card className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 border-2 border-green-300 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-6 h-6 text-green-600" />
              <span>{modelIcon}</span>
              <span>Muhasebe Verisi</span>
            </CardTitle>
            {accountingResult.error && (
              <p className="text-sm text-red-600">⚠️ Hata: {accountingResult.error}</p>
            )}
            {!accountingResult.error && (
              <p className="text-xs text-muted-foreground">
                İşlem Süresi: {accountingResult.processing_time_ms.toFixed(0)}ms • 
                Maliyet: {formatCost(accountingResult.estimated_cost)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!accountingResult.error ? (
              <>
                {/* Split Screen: Muhasebe ve Görsel Yan Yana */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Sol: Muhasebe Verileri */}
                  <div className="space-y-4">
                    <AccountingView
                      data={accountingResult.accounting_data}
                      processingTime={accountingResult.processing_time_ms}
                      ocrProcessingTime={result?.processing_time_ms}
                      ocrCost={result?.estimated_cost}
                      cost={accountingResult.estimated_cost}
                      rawGptResponse={accountingResult.raw_gpt_response}
                    />
                  </div>
                  
                  {/* Sağ: Analiz Edilen Görsel */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <FileImage className="w-4 h-4" />
                        Analiz Edilen Görsel
                      </h3>
                      {(fileState.croppedFile || fileState.selectedFile) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => imageModal.openModal()}
                          className="flex items-center gap-1 text-xs"
                        >
                          <ZoomIn className="w-3 h-3" />
                          Büyüt
                        </Button>
                      )}
                    </div>
                    <div 
                      className="border-2 border-border rounded-lg overflow-hidden bg-secondary cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => imageModal.openModal()}
                    >
                      {(fileState.croppedFile || fileState.selectedFile) && (
                        <img 
                          src={URL.createObjectURL(fileState.croppedFile || fileState.selectedFile!)}
                          alt="Analiz edilen fiş"
                          className="w-full h-auto max-h-[600px] object-contain"
                        />
                      )}
                    </div>
                    <p className="text-xs text-blue-600 text-center">💡 Görsele tıklayarak büyütebilirsiniz</p>
                  </div>
                </div>
                
                {/* Test Kaydetme ve Etiketleme */}
                <div className="pt-4 border-t">
                  <Button
                    onClick={handleSaveTest}
                    disabled={loading.savingTest}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6"
                  >
                    {loading.savingTest ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Kaydediliyor...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        💾 Test Olarak Kaydet ve Etiketle
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Bu model için muhasebe verisi çıkarılamadı</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Yönlendirme Mesajı */}
      {!fileState.selectedFile && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="font-semibold mb-2">🎯 Test Akışı:</p>
              <ol className="text-left inline-block text-sm space-y-1">
                <li>1️⃣ Özel prompt girin (opsiyonel)</li>
                <li>2️⃣ Fiş görseli yükleyin</li>
                <li>3️⃣ OCR analizi yapın</li>
                <li>4️⃣ OCR çıktısını inceleyin</li>
                <li>5️⃣ Muhasebe verisi çıkarın</li>
                <li>6️⃣ Sonuçları değerlendirin</li>
                <li>7️⃣ Prompt'u optimize edin</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Cropper Modal */}
      {fileState.showCropper && fileState.selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <ImageCropper
              imageFile={fileState.selectedFile}
              onCropComplete={handleCropComplete}
              onCancel={() => fileState.setShowCropper(false)}
            />
          </div>
        </div>
      )}

      {/* Label Test Modal */}
      {showLabelModal && savedTestId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-6 h-6" />
                Test Etiketleme
              </CardTitle>
              <p className="text-sm text-muted-foreground">Bu testin sonucunu değerlendirin</p>
            </CardHeader>
            <CardContent>
              <LabelTestForm
                testId={savedTestId}
                modelName={modelType}
                ocrText={result?.text_content}
                accountingData={accountingResult?.accounting_data}
                onClose={() => {
                  setShowLabelModal(false)
                  setSavedTestId(null)
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt Selector Modal */}
      {showReceiptSelector && (
        <ReceiptSelector
          onSelect={handleReceiptSelect}
          onClose={() => setShowReceiptSelector(false)}
          modelType={modelType}
        />
      )}

      {/* Image Modal - Büyüteç */}
      {imageModal.showModal && (fileState.croppedFile || fileState.selectedFile) && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => imageModal.closeModal()}
        >
          <div className="relative max-w-7xl max-h-screen" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => imageModal.closeModal()}
              className="absolute top-4 right-4 z-10 bg-card hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </Button>
            
            {/* Zoom Controls */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => imageModal.zoomOut()}
                className="bg-card hover:bg-secondary"
              >
                −
              </Button>
              <div className="bg-card px-3 py-1 rounded text-sm font-semibold">
                {Math.round(imageModal.imageScale * 100)}%
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => imageModal.zoomIn()}
                className="bg-card hover:bg-secondary"
              >
                +
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => imageModal.resetZoom()}
                className="bg-card hover:bg-secondary"
              >
                Reset
              </Button>
            </div>

            {/* Image */}
            <div className="overflow-auto max-h-[90vh] max-w-[90vw] bg-secondary rounded-lg p-4">
              <img
                src={URL.createObjectURL(fileState.croppedFile || fileState.selectedFile!)}
                alt="Fiş büyütülmüş görünüm"
                className="cursor-move"
                style={{
                  width: `${imageModal.imageScale * 100}%`,
                  height: 'auto',
                  transition: 'width 0.2s ease-in-out'
                }}
              />
            </div>
            
            <div className="text-center mt-4 text-white text-sm">
              <p>📸 {(fileState.croppedFile || fileState.selectedFile)?.name}</p>
              <p className="text-xs text-muted-foreground mt-1 opacity-75">
                + / − butonları ile yakınlaştır/uzaklaştır • ESC veya dışarı tıkla ile kapat
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Label Test Form Component
interface LabelTestFormProps {
  testId: string
  modelName: string
  ocrText?: string
  accountingData?: any
  onClose: () => void
}

const LabelTestForm: React.FC<LabelTestFormProps> = ({ testId, modelName, ocrText, accountingData, onClose }) => {
  const [label, setLabel] = useState<string>('')
  const [errorType, setErrorType] = useState<string>('')
  const [userNotes, setUserNotes] = useState('')
  const [tags, setTags] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!label) {
      alert('Lütfen bir sonuç seçin (Doğru/Yanlış/Kısmi Doğru)')
      return
    }

    setIsSubmitting(true)
    try {
      await labelPromptTest(
        testId,
        label,
        errorType || undefined,
        undefined,
        undefined,
        userNotes || undefined,
        tags ? parseTags(tags) : undefined
      )
      alert('✅ Test başarıyla etiketlendi!')
      onClose()
    } catch (error) {
      console.error('Etiketleme hatası:', error)
      alert('❌ Etiketleme başarısız: ' + (error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sonuç Seçimi */}
      <div>
        <label className="block text-sm font-semibold mb-3">Sonuç Değerlendirmesi *</label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setLabel('correct')}
            className={`p-4 rounded-lg border-2 transition-all ${
              label === 'correct'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-300 hover:border-green-300'
            }`}
          >
            <CheckCircle className="w-8 h-8 mx-auto mb-2" />
            <div className="font-semibold">Doğru</div>
          </button>
          <button
            onClick={() => setLabel('incorrect')}
            className={`p-4 rounded-lg border-2 transition-all ${
              label === 'incorrect'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-300 hover:border-red-300'
            }`}
          >
            <XCircle className="w-8 h-8 mx-auto mb-2" />
            <div className="font-semibold">Yanlış</div>
          </button>
          <button
            onClick={() => setLabel('partial')}
            className={`p-4 rounded-lg border-2 transition-all ${
              label === 'partial'
                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                : 'border-gray-300 hover:border-yellow-300'
            }`}
          >
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <div className="font-semibold">Kısmi Doğru</div>
          </button>
        </div>
      </div>

      {/* Hata Tipi */}
      {label === 'incorrect' || label === 'partial' ? (
        <div>
          <label className="block text-sm font-semibold mb-2">Hata Kaynağı</label>
          <select
            value={errorType}
            onChange={(e) => setErrorType(e.target.value)}
            className="w-full p-2 border rounded-md bg-background text-foreground dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="">Seçiniz...</option>
            <option value="ocr_error">OCR Hatası (Metin yanlış okundu)</option>
            <option value="gpt_error">GPT Hatası (Muhasebe verisi yanlış çıkarıldı)</option>
            <option value="both">Her İkisi (Hem OCR hem GPT hatası)</option>
            <option value="none">Diğer/Belirsiz</option>
          </select>
        </div>
      ) : null}

      {/* Notlar */}
      <div>
        <label className="block text-sm font-semibold mb-2">Notlar ve Açıklamalar</label>
        <textarea
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
          placeholder="Neden bu sonuca vardınız? Detayları yazın..."
          className="w-full p-3 border rounded-md min-h-[100px] bg-background text-foreground dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400"
        />
      </div>

      {/* Etiketler */}
      <div>
        <label className="block text-sm font-semibold mb-2">Etiketler (virgülle ayırın)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="örn: akaryakit, yüksek_tutar, karmaşık_kdv"
          className="w-full p-2 border rounded-md bg-background text-foreground dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400"
        />
        <p className="text-xs text-muted-foreground mt-1">Örnek: akaryakit, market, restoran, yüksek_tutar</p>
      </div>

      {/* OCR Metni Önizleme */}
      {ocrText && (
        <div>
          <label className="block text-sm font-semibold mb-2">OCR Metni (Önizleme)</label>
          <div className="bg-secondary p-3 rounded border max-h-40 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap">{ocrText.substring(0, 500)}...</pre>
          </div>
        </div>
      )}

      {/* Butonlar */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          onClick={onClose}
          variant="outline"
          className="flex-1"
          disabled={isSubmitting}
        >
          İptal
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !label}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Etiketle ve Kaydet
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
