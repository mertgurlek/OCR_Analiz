import { useState, useEffect } from 'react'
import { FileUpload } from './components/FileUpload'
import { PromptSettings } from './components/PromptSettings'
import { ComparisonResults } from './components/ComparisonResults'
import { HistoryPanel } from './components/HistoryPanel'
import { SingleModelTest } from './components/SingleModelTest'
import { ReceiptLibrary } from './pages/ReceiptLibrary'
import { Statistics } from './pages/Statistics'
import { ReceiptSelector } from './components/ReceiptSelector'
import { Button } from './components/ui/button'
import { analyzeReceipt, evaluateAnalysis, getAnalysis, getAccountingAnalysis, healthCheck, ReceiptResponse } from './api/client'
import { AnalysisResponse, OCRModelType, MODEL_NAMES } from './types'
import { Menu, X, Layers, BarChart3, Save, Database, Moon, Sun, FileImage } from 'lucide-react'
import { logger } from './utils/logger'
import { formatCost } from './lib/formatters'

function App() {
  logger.render('App')
  
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'openai' | 'google' | 'textract' | 'paddle' | 'history' | 'receipts' | 'statistics'>('all')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved === 'true'
  })
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [croppedFile, setCroppedFile] = useState<File | null>(null)
  const [cropData, setCropData] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState<OCRModelType[]>([
    OCRModelType.OPENAI_VISION,      // 🤖 En akıllı model
    OCRModelType.GOOGLE_DOCAI,       // 📄 Google'ın güçlü OCR'ı
    OCRModelType.AMAZON_TEXTRACT,    // 🔍 AWS'nin hızlı servisi ✅ TEST EDİLDİ
    OCRModelType.PADDLE_OCR          // 🐼 Ücretsiz yerel model
  ])
  
  const [analyses, setAnalyses] = useState<AnalysisResponse[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResponse | null>(null)
  const [correctModels, setCorrectModels] = useState<Set<string>>(new Set())
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [showReceiptSelector, setShowReceiptSelector] = useState(false)
  // selectedReceiptId kaldırıldı - kullanılmıyordu
  
  logger.state('App state', {
    isAnalyzing,
    hasCurrentAnalysis: !!currentAnalysis,
    analysesCount: analyses.length,
    selectedModelsCount: selectedModels.length
  })

  // Dark mode kontrolü
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, [darkMode])

  // Backend bağlantısını test et
  useEffect(() => {
    const testBackendConnection = async () => {
      try {
        logger.info('Backend bağlantısı test ediliyor...')
        const health = await healthCheck()
        logger.success('Backend bağlantısı başarılı', health)
        setBackendStatus('connected')
      } catch (error) {
        logger.error('Backend bağlantı hatası', error)
        setBackendStatus('error')
      }
    }

    testBackendConnection()
  }, [])
  
  const handleReceiptSelect = async (receipt: ReceiptResponse, useVersion: 'original' | 'cropped') => {
    try {
      setShowReceiptSelector(false)
      
      const imagePath = useVersion === 'cropped' && receipt.cropped_image_path 
        ? receipt.cropped_image_path 
        : receipt.original_image_path
      
      const response = await fetch(`http://localhost:8000${imagePath}`)
      const blob = await response.blob()
      const file = new File([blob], receipt.name, { type: 'image/jpeg' })
      
      if (useVersion === 'cropped') {
        await handleFileSelect(file, file)
      } else {
        await handleFileSelect(file)
      }
    } catch (error) {
      logger.error('Görsel yükleme hatası', error)
      alert('❌ Görsel yüklenemedi')
    }
  }
  
  const handleFileSelect = async (originalFile: File, croppedFile?: File, cropData?: any) => {
    logger.stage(1, 'Dosya seçildi', { 
      original: originalFile.name, 
      originalSize: originalFile.size,
      cropped: croppedFile?.name,
      croppedSize: croppedFile?.size,
      cropInfo: cropData
    })
    
    setSelectedFile(originalFile)
    setCroppedFile(croppedFile || null)
    setCropData(cropData || null)
    
    logger.stage(2, 'State güncellendi')
    setIsAnalyzing(true)
    setCurrentAnalysis(null)
    setCorrectModels(new Set())
    
    logger.stage(3, 'Analiz başlatılıyor', {
      selectedModels,
      prompt: prompt || 'Boş'
    })
    
    try {
      // Kırpılmış görsel varsa onu kullan, yoksa orijinali kullan
      const fileToAnalyze = croppedFile || originalFile
      logger.info('Analiz başlıyor', {
        fileName: fileToAnalyze.name,
        fileSize: fileToAnalyze.size,
        selectedModels,
        prompt
      })
      
      logger.stage(4, 'API çağrısı yapılıyor')
      const result = await analyzeReceipt(
        fileToAnalyze,
        prompt || undefined,
        selectedModels.length > 0 ? selectedModels : undefined
      )
      
      logger.stage(5, 'API yanıtı alındı')
      logger.success('Analiz sonucu', {
        analysisId: result.analysis_id,
        fileName: result.file_name,
        resultCount: result.results?.length || 0,
        totalCost: result.total_cost,
        fullResult: result
      })
      
      logger.stage(6, 'State güncelleniyor', { prevCount: analyses.length })
      
      setCurrentAnalysis(result)
      const newAnalyses = [result, ...analyses]
      setAnalyses(newAnalyses)
      
      logger.stage(7, 'Analiz tamamlandı! ✅', { newCount: newAnalyses.length })
    } catch (error: any) {
      logger.error('Analiz hatası', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        }
      })
      
      // Detaylı hata mesajı oluştur
      let errorMessage = 'Analiz sırasında bir hata oluştu.'
      
      if (error.response?.data?.detail) {
        errorMessage += `\n\nDetay: ${error.response.data.detail}`
      } else if (error.message) {
        errorMessage += `\n\nHata: ${error.message}`
      }
      
      if (error.response?.status) {
        errorMessage += `\n\nHTTP Status: ${error.response.status}`
      }
      
      alert(errorMessage + '\n\nLütfen tekrar deneyin.')
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  const handleToggleCorrect = (modelName: string) => {
    const newCorrect = new Set(correctModels)
    if (newCorrect.has(modelName)) {
      newCorrect.delete(modelName)
    } else {
      newCorrect.add(modelName)
    }
    setCorrectModels(newCorrect)
  }
  
  const handleSaveEvaluation = async () => {
    if (!currentAnalysis) return
    
    setIsSaving(true)
    try {
      await evaluateAnalysis(
        currentAnalysis.analysis_id,
        Array.from(correctModels) as OCRModelType[]
      )
      alert('Değerlendirme kaydedildi!')
    } catch (error) {
      console.error('Değerlendirme kaydetme hatası:', error)
      alert('Değerlendirme kaydedilirken hata oluştu.')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleSelectAnalysis = async (analysisId: string) => {
    try {
      logger.info('📊 Analiz yükleniyor:', analysisId)
      const analysis = await getAnalysis(analysisId)
      setCurrentAnalysis(analysis)
      setCorrectModels(new Set())
      
      // Geçmiş ekranındaysa otomatik muhasebe verisi yükle
      if (activeTab === 'history') {
        logger.info('💰 Muhasebe verisi otomatik yükleniyor...')
        try {
          const accountingResponse = await getAccountingAnalysis(analysisId)
          logger.success('✅ Muhasebe verisi yüklendi')
          // Muhasebe verisini analysis objesine ekle (geçici çözüm)
          setCurrentAnalysis({
            ...analysis,
            accountingData: accountingResponse
          } as any)
        } catch (error) {
          logger.error('⚠️ Muhasebe verisi yüklenemedi:', error)
          // Hata olursa sadece analysis'i göster
        }
      }
    } catch (error) {
      console.error('Analiz yükleme hatası:', error)
    }
  }
  
  const totalCost = analyses.reduce((sum, a) => sum + a.total_cost, 0)
  
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 bg-card border-r border-border overflow-hidden flex flex-col`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ayarlar</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Navigation Tabs */}
          <div className="space-y-2">
            <Button
              variant={activeTab === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('all')}
              className="w-full justify-start"
            >
              <Layers className="w-4 h-4 mr-2" />
              🎯 Tüm Modeller
            </Button>
            
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground px-2 mb-2 font-semibold">TEKLİ TEST</p>
              <Button
                variant={activeTab === 'openai' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('openai')}
                className="w-full justify-start"
              >
                🤖 OpenAI Vision
              </Button>
              <Button
                variant={activeTab === 'google' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('google')}
                className="w-full justify-start"
              >
                📄 Google DocAI
              </Button>
              <Button
                variant={activeTab === 'textract' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('textract')}
                className="w-full justify-start"
              >
                🔍 Amazon Textract
              </Button>
              <Button
                variant={activeTab === 'paddle' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('paddle')}
                className="w-full justify-start"
              >
                🐼 PaddleOCR
              </Button>
            </div>
            
            <div className="border-t pt-2">
              <Button
                variant={activeTab === 'receipts' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('receipts')}
                className="w-full justify-start"
              >
                <Database className="w-4 h-4 mr-2" />
                📚 Fiş Datası
              </Button>
              <Button
                variant={activeTab === 'statistics' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('statistics')}
                className="w-full justify-start"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                📊 İstatistikler
              </Button>
              <Button
                variant={activeTab === 'history' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('history')}
                className="w-full justify-start"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                📈 Geçmiş
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'all' && (
            <PromptSettings
              prompt={prompt}
              onPromptChange={setPrompt}
              selectedModels={selectedModels}
              onModelsChange={setSelectedModels}
            />
          )}
          {activeTab === 'history' && (
            <HistoryPanel 
              onSelectAnalysis={handleSelectAnalysis} 
              refreshTrigger={analyses.length}
            />
          )}
          {activeTab !== 'all' && activeTab !== 'history' && activeTab !== 'receipts' && activeTab !== 'statistics' && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Tekli test modları içerik alanında görünür</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-xl font-bold">
                  Fiş Okuma OCR A/B Test Platformu
                </h1>
                <p className="text-sm text-muted-foreground">
                  4 farklı OCR modelini karşılaştırın
                  {backendStatus === 'checking' && <span className="ml-2 text-yellow-600 dark:text-yellow-400">• Backend kontrol ediliyor...</span>}
                  {backendStatus === 'connected' && <span className="ml-2 text-green-600 dark:text-green-400">• Backend bağlı</span>}
                  {backendStatus === 'error' && <span className="ml-2 text-red-600 dark:text-red-400">• Backend bağlantı hatası!</span>}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
                title={darkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Toplam Analiz</p>
                <p className="text-lg font-bold">{analyses.length}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Toplam Maliyet</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCost(totalCost)}</p>
              </div>
            </div>
          </div>
        </header>
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Tekli Model Testleri */}
            {activeTab === 'openai' && (
              <SingleModelTest modelType={OCRModelType.OPENAI_VISION} modelIcon="🤖" />
            )}
            {activeTab === 'google' && (
              <SingleModelTest modelType={OCRModelType.GOOGLE_DOCAI} modelIcon="📄" />
            )}
            {activeTab === 'textract' && (
              <SingleModelTest modelType={OCRModelType.AMAZON_TEXTRACT} modelIcon="🔍" />
            )}
            {activeTab === 'paddle' && (
              <SingleModelTest modelType={OCRModelType.PADDLE_OCR} modelIcon="🐼" />
            )}
            
            {/* Fiş Datası */}
            {activeTab === 'receipts' && (
              <ReceiptLibrary />
            )}
            
            {/* İstatistikler */}
            {activeTab === 'statistics' && (
              <Statistics />
            )}
            
            {/* Geçmiş - Seçilen Analiz Detayı */}
            {activeTab === 'history' && (
              <div>
                {currentAnalysis ? (
                  <div>
                    {/* Üst Özet Kartı - Görsel + Bilgiler */}
                    <div className="mb-6 bg-card border rounded-lg overflow-hidden">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Sol: Fiş Görseli */}
                        <div className="p-4">
                          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            🖼️ Fiş Görseli
                          </h3>
                          <div className="flex justify-center items-center bg-muted rounded-lg p-4">
                            {currentAnalysis.original_image_path ? (
                              <img 
                                src={`http://localhost:8000${currentAnalysis.original_image_path}`}
                                alt={currentAnalysis.file_name}
                                className="max-w-full max-h-96 object-contain rounded border shadow-sm"
                              />
                            ) : (
                              <div className="text-center py-12 text-muted-foreground">
                                <FileImage className="w-16 h-16 mx-auto mb-2 opacity-50" />
                                <p>Görsel bulunamadı</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Sağ: Analiz Detayları */}
                        <div className="p-4">
                          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            📊 Analiz Bilgileri
                          </h3>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center p-2 bg-muted rounded">
                              <span className="text-muted-foreground">📁 Dosya Adı</span>
                              <span className="font-semibold">{currentAnalysis.file_name}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-muted rounded">
                              <span className="text-muted-foreground">🕐 Yüklenme</span>
                              <span className="font-semibold">
                                {new Date(currentAnalysis.upload_timestamp).toLocaleString('tr-TR')}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-muted rounded">
                              <span className="text-muted-foreground">🆔 Analiz ID</span>
                              <span className="font-mono text-xs">{currentAnalysis.analysis_id}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-muted rounded">
                              <span className="text-muted-foreground">💵 Toplam Maliyet</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {formatCost(currentAnalysis.total_cost)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-muted rounded">
                              <span className="text-muted-foreground">🤖 Model Sayısı</span>
                              <span className="font-semibold">{currentAnalysis.results.length} model</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-muted rounded">
                              <span className="text-muted-foreground">📦 Dosya Boyutu</span>
                              <span className="font-semibold">
                                {(currentAnalysis.file_size_bytes / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            
                            {/* En İyi Model */}
                            {currentAnalysis.results.length > 0 && (
                              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
                                <p className="text-xs text-muted-foreground mb-1">🏆 En İyi Model</p>
                                <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                                  {MODEL_NAMES[currentAnalysis.results[0].model_name]}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Detaylı Karşılaştırma */}
                    <ComparisonResults
                      analysis={currentAnalysis}
                      correctModels={correctModels}
                      onToggleCorrect={handleToggleCorrect}
                      preloadedAccountingData={(currentAnalysis as any).accountingData}
                    />
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                      <BarChart3 className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Analiz Seç</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Sol taraftaki geçmiş listesinden bir analiz seçin ve detaylarını görüntüleyin
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Tüm Modeller Karşılaştırması */}
            {activeTab === 'all' && (
              <>
                {/* Upload Area ve Datadan Seç */}
                <div className="mb-6 space-y-4">
                  <FileUpload onFileSelect={handleFileSelect} isLoading={isAnalyzing} />
                  
                  <div className="flex justify-center">
                    <Button
                      onClick={() => setShowReceiptSelector(true)}
                      variant="outline"
                      size="lg"
                      disabled={isAnalyzing}
                      className="w-full max-w-md"
                    >
                      <Database className="w-5 h-5 mr-2" />
                      📚 Fiş Datasından Seç
                    </Button>
                  </div>
                </div>
                
                {/* Loading State */}
                {isAnalyzing && (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="mt-4 text-muted-foreground">4 model ile analiz yapılıyor...</p>
                  </div>
                )}
                
                {/* Results */}
                {currentAnalysis && !isAnalyzing && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-bold">Analiz Sonuçları</h2>
                        <p className="text-sm text-muted-foreground">
                          {currentAnalysis.file_name} - {currentAnalysis.results.length} model karşılaştırması
                          {croppedFile && <span className="ml-2 text-blue-600 dark:text-blue-400">(Kırpılmış)</span>}
                          {cropData && <span className="ml-1 text-green-600 dark:text-green-400">({Math.round(cropData.width)}×{Math.round(cropData.height)}px)</span>}
                        </p>
                      </div>
                      
                      {correctModels.size > 0 && (
                        <Button onClick={handleSaveEvaluation} disabled={isSaving}>
                          <Save className="w-4 h-4 mr-2" />
                          Değerlendirmeyi Kaydet
                        </Button>
                      )}
                    </div>
                    
                    <ComparisonResults
                      analysis={currentAnalysis}
                      correctModels={correctModels}
                      onToggleCorrect={handleToggleCorrect}
                      originalImage={selectedFile}
                      croppedImage={croppedFile}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Receipt Selector Modal */}
      {showReceiptSelector && (
        <ReceiptSelector
          onSelect={handleReceiptSelect}
          onClose={() => setShowReceiptSelector(false)}
        />
      )}
    </div>
  )
}

export default App
