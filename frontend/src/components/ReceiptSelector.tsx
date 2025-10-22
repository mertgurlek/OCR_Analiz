import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { getReceipts, ReceiptResponse } from '@/api/client'
import { Loader2, Search, X, FileImage, CheckCircle2 } from 'lucide-react'
import { OCRModelType } from '@/types'
import { filterReceipts as filterReceiptsUtil } from '@/lib/receiptFilters'
import { CategorySelect } from './CategorySelect'

interface ReceiptSelectorProps {
  onSelect: (receipt: ReceiptResponse, useVersion: 'original' | 'cropped') => void
  onClose: () => void
  modelType?: OCRModelType  // Hangi model için seçim yapılıyor
}

export const ReceiptSelector: React.FC<ReceiptSelectorProps> = ({ onSelect, onClose, modelType }) => {
  const [receipts, setReceipts] = useState<ReceiptResponse[]>([])
  const [filteredReceipts, setFilteredReceipts] = useState<ReceiptResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [groundTruthFilter, setGroundTruthFilter] = useState<boolean | undefined>(undefined)
  const [sortBy, setSortBy] = useState<'default' | 'success_desc' | 'success_asc' | 'test_count'>('default')
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptResponse | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<'original' | 'cropped'>('original')

  useEffect(() => {
    loadReceipts()
  }, [categoryFilter, groundTruthFilter, modelType])

  useEffect(() => {
    filterReceipts()
  }, [searchTerm, receipts, sortBy])

  const loadReceipts = async () => {
    setIsLoading(true)
    try {
      const response = await getReceipts({
        category: categoryFilter || undefined,
        has_ground_truth: groundTruthFilter,
        limit: 200,  // Show all receipts (increased from 50/100)
        include_model_stats: !!modelType  // Model seçiliyse istatistikleri çek
      })
      setReceipts(response.receipts)
      setFilteredReceipts(response.receipts)
    } catch (error) {
      console.error('Fiş yükleme hatası:', error)
      alert('Fişler yüklenemedi')
    } finally {
      setIsLoading(false)
    }
  }

  const filterReceipts = () => {
    let filtered = filterReceiptsUtil(receipts, searchTerm)
    
    // Sıralama uygula
    if (sortBy !== 'default' && modelType) {
      filtered = [...filtered].sort((a, b) => {
        const aStats = a.model_stats?.[modelType]
        const bStats = b.model_stats?.[modelType]
        
        // İstatistik yoksa sona at
        if (!aStats && !bStats) return 0
        if (!aStats) return 1
        if (!bStats) return -1
        
        switch (sortBy) {
          case 'success_desc':
            // Başarı oranı: Yüksek -> Düşük
            return bStats.success_rate - aStats.success_rate
          case 'success_asc':
            // Başarı oranı: Düşük -> Yüksek
            return aStats.success_rate - bStats.success_rate
          case 'test_count':
            // Test sayısı: Çok -> Az
            return bStats.test_count - aStats.test_count
          default:
            return 0
        }
      })
    }
    
    setFilteredReceipts(filtered)
  }

  const handleSelect = () => {
    if (!selectedReceipt) return
    onSelect(selectedReceipt, selectedVersion)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileImage className="w-6 h-6" />
              Fiş Datası - Fiş Seçin
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-6">
          {/* Filtreler */}
          <div className="space-y-4 mb-6">
            {/* Arama */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Fiş adı, açıklama veya kategori ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>

            {/* Kategori ve Ground Truth Filtreleri */}
            <div className="flex gap-3 flex-wrap">
              <CategorySelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                includeAll={true}
              />

              <select
                value={groundTruthFilter === undefined ? '' : groundTruthFilter.toString()}
                onChange={(e) => {
                  const val = e.target.value
                  setGroundTruthFilter(val === '' ? undefined : val === 'true')
                }}
                className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="">Tüm Fişler</option>
                <option value="true">Ground Truth Var</option>
                <option value="false">Ground Truth Yok</option>
              </select>

              {/* Sıralama */}
              {modelType && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="default">Varsayılan Sıralama</option>
                  <option value="success_desc">Başarı Oranı (Yüksek → Düşük)</option>
                  <option value="success_asc">Başarı Oranı (Düşük → Yüksek)</option>
                  <option value="test_count">Test Sayısı (Çok → Az)</option>
                </select>
              )}

              <div className="flex-1 text-right text-sm text-muted-foreground">
                {filteredReceipts.length} fiş bulundu
              </div>
            </div>
          </div>

          {/* Fiş Listesi */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-3">Fişler yükleniyor...</span>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileImage className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p>Hiç fiş bulunamadı</p>
              <p className="text-sm mt-2">Fiş Datası sayfasından fiş yükleyebilirsiniz</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredReceipts.map(receipt => (
                <button
                  key={receipt.id}
                  onClick={() => {
                    setSelectedReceipt(receipt)
                    setSelectedVersion(receipt.is_cropped ? 'cropped' : 'original')
                  }}
                  className={`p-3 border-2 rounded-lg transition-all hover:border-blue-400 ${
                    selectedReceipt?.id === receipt.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="aspect-[3/4] bg-secondary rounded mb-2 flex items-center justify-center overflow-hidden">
                    {receipt.original_image_path ? (
                      <img 
                        src={receipt.is_cropped && receipt.cropped_image_path ? receipt.cropped_image_path : receipt.original_image_path}
                        alt={receipt.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const parent = e.currentTarget.parentElement
                          if (parent) {
                            parent.innerHTML = '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>'
                          }
                        }}
                      />
                    ) : (
                      <FileImage className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm truncate">{receipt.name}</p>
                    {receipt.category && (
                      <p className="text-xs text-muted-foreground">{receipt.category}</p>
                    )}
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {receipt.is_cropped && (
                        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1 py-0.5 rounded">
                          Kırpılmış
                        </span>
                      )}
                      {receipt.has_ground_truth && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded">
                          GT
                        </span>
                      )}
                      {modelType && receipt.model_stats?.[modelType] && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-1 py-0.5 rounded font-semibold">
                          {receipt.model_stats[modelType].test_count} test • {receipt.model_stats[modelType].success_rate.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {selectedReceipt?.id === receipt.id && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500 absolute top-2 right-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>

        {/* Alt Bölüm - Versiyon Seçimi ve Onay */}
        {selectedReceipt && (
          <div className="border-t border-border p-4 bg-secondary">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-semibold mb-2">Seçili: {selectedReceipt.name}</p>
                {selectedReceipt.is_cropped && (
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="version"
                        checked={selectedVersion === 'original'}
                        onChange={() => setSelectedVersion('original')}
                      />
                      <span className="text-sm">Orijinal</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="version"
                        checked={selectedVersion === 'cropped'}
                        onChange={() => setSelectedVersion('cropped')}
                      />
                      <span className="text-sm">Kırpılmış</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  İptal
                </Button>
                <Button onClick={handleSelect} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Seç ve Devam Et
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
