import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImageCropper } from '@/components/ImageCropper'
import { 
  getReceipts, 
  uploadReceipts, 
  updateReceipt,
  deleteReceipt,
  getReceiptStatistics,
  cropReceipt,
  ReceiptResponse,
  ReceiptStatistics
} from '@/api/client'
import { filterReceipts as filterReceiptsUtil } from '@/lib/receiptFilters'
import { parseTags } from '@/lib/utils'
import { CategorySelect } from '@/components/CategorySelect'
import { 
  Upload, 
  Loader2, 
  FileImage, 
  Search, 
  Trash2, 
  CheckCircle2,
  Plus,
  SkipForward,
  Save
} from 'lucide-react'

export const ReceiptLibrary: React.FC = () => {
  const [receipts, setReceipts] = useState<ReceiptResponse[]>([])
  const [filteredReceipts, setFilteredReceipts] = useState<ReceiptResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statistics, setStatistics] = useState<ReceiptStatistics | null>(null)
  
  // Filtreler
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [groundTruthFilter, setGroundTruthFilter] = useState<boolean | undefined>(undefined)
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showBatchCropModal, setShowBatchCropModal] = useState(false)
  const [showBatchRenameModal, setShowBatchRenameModal] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptResponse | null>(null)

  useEffect(() => {
    loadReceipts()
    loadStatistics()
  }, [categoryFilter, groundTruthFilter])

  useEffect(() => {
    filterReceipts()
  }, [searchTerm, receipts])

  const loadReceipts = async () => {
    setIsLoading(true)
    try {
      const response = await getReceipts({
        category: categoryFilter || undefined,
        has_ground_truth: groundTruthFilter,
        limit: 200,
        include_model_stats: false  // Performans için istatistikleri çekme
      })
      // İsme göre sırala (doğal sıralama: test-1, test-2, test-10 vs.)
      const sorted = response.receipts.sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      })
      setReceipts(sorted)
      setFilteredReceipts(sorted)
    } catch (error) {
      console.error('Fiş yükleme hatası:', error)
      alert('Fişler yüklenemedi')
    } finally {
      setIsLoading(false)
    }
  }

  const loadStatistics = async () => {
    try {
      const stats = await getReceiptStatistics()
      setStatistics(stats)
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error)
    }
  }

  const filterReceipts = () => {
    const filtered = filterReceiptsUtil(receipts, searchTerm)
    setFilteredReceipts(filtered)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu fişi silmek istediğinize emin misiniz?')) return
    
    try {
      await deleteReceipt(id)
      await loadReceipts()
      await loadStatistics()
      alert('✅ Fiş silindi')
    } catch (error) {
      console.error('Silme hatası:', error)
      alert('❌ Fiş silinemedi')
    }
  }

  const handleReceiptClick = async (receipt: ReceiptResponse) => {
    setSelectedReceipt(receipt)
    setShowDetailModal(true)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📚 Fiş Datası</h1>
          <p className="text-muted-foreground mt-1">Toplu fiş yükleme, kırpma ve ground truth yönetimi</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowBatchCropModal(true)}
            className="bg-green-600 hover:bg-green-700"
            disabled={!statistics || statistics.total_receipts === statistics.cropped_receipts}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
            Toplu Kırpma
          </Button>
          <Button
            onClick={() => setShowBatchRenameModal(true)}
            className="bg-purple-600 hover:bg-purple-700"
            disabled={!statistics || statistics.total_receipts === 0}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Toplu İsimlendirme
          </Button>
          <Button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Toplu Yükle
          </Button>
        </div>
      </div>

      {/* İstatistikler */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{statistics.total_receipts}</p>
                <p className="text-sm text-muted-foreground mt-1">Toplam Fiş</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{statistics.cropped_receipts}</p>
                <p className="text-sm text-muted-foreground mt-1">Kırpılmış</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{statistics.receipts_with_ground_truth}</p>
                <p className="text-sm text-muted-foreground mt-1">Ground Truth</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">{statistics.total_tests}</p>
                <p className="text-sm text-muted-foreground mt-1">Toplam Test</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtreler */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
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

            {/* Kategori ve Ground Truth */}
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

              <div className="flex-1 text-right text-sm text-muted-foreground self-center">
                {filteredReceipts.length} fiş gösteriliyor
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fiş Listesi */}
      <Card>
        <CardHeader>
          <CardTitle>Fiş Galerisi</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-3">Fişler yükleniyor...</span>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileImage className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p>Hiç fiş bulunamadı</p>
              <p className="text-sm mt-2">Toplu yükleme yaparak başlayabilirsiniz</p>
              <Button
                onClick={() => setShowUploadModal(true)}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                İlk Fişi Yükle
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredReceipts.map(receipt => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  onClick={() => handleReceiptClick(receipt)}
                  onDelete={() => handleDelete(receipt.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            loadReceipts()
            loadStatistics()
            setShowUploadModal(false)
          }}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedReceipt && (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedReceipt(null)
          }}
          onUpdate={() => {
            loadReceipts()
            loadStatistics()
          }}
        />
      )}

      {/* Batch Crop Modal */}
      {showBatchCropModal && (
        <BatchCropModal
          receipts={receipts}
          onClose={() => setShowBatchCropModal(false)}
          onUpdate={() => {
            loadReceipts()
            loadStatistics()
          }}
        />
      )}

      {/* Batch Rename Modal */}
      {showBatchRenameModal && (
        <BatchRenameModal
          receipts={receipts}
          onClose={() => setShowBatchRenameModal(false)}
          onUpdate={() => {
            loadReceipts()
            loadStatistics()
          }}
        />
      )}
    </div>
  )
}

// Receipt Card Component
interface ReceiptCardProps {
  receipt: ReceiptResponse
  onClick: () => void
  onDelete: () => void
}

const ReceiptCard: React.FC<ReceiptCardProps> = ({ receipt, onClick, onDelete }) => {
  // Gösterilecek görsel path'i (kırpılmışsa onu, yoksa orijinali)
  const imagePath = receipt.is_cropped && receipt.cropped_image_path 
    ? receipt.cropped_image_path 
    : receipt.original_image_path

  return (
    <div className="border-2 border-border rounded-lg p-3 hover:border-blue-400 transition-all cursor-pointer relative group bg-card">
      <div onClick={onClick}>
        <div className="aspect-[3/4] bg-secondary rounded mb-2 flex items-center justify-center overflow-hidden">
          {imagePath ? (
            <img 
              src={imagePath} 
              alt={receipt.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Görsel yüklenemezse fallback icon
                e.currentTarget.style.display = 'none'
                e.currentTarget.parentElement!.innerHTML = '<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>'
              }}
            />
          ) : (
            <FileImage className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="font-semibold text-sm truncate">{receipt.name}</p>
          {receipt.category && (
            <p className="text-xs text-muted-foreground">{receipt.category}</p>
          )}
          <div className="flex gap-1 mt-2 flex-wrap">
            {receipt.is_cropped && (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                ✂️ Kırpılmış
              </span>
            )}
            {receipt.has_ground_truth && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                ✓ GT
              </span>
            )}
            {receipt.test_count > 0 && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                {receipt.test_count} test
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// Upload Modal Component
interface UploadModalProps {
  onClose: () => void
  onSuccess: () => void
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onSuccess }) => {
  const [files, setFiles] = useState<File[]>([])
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Lütfen en az bir dosya seçin')
      return
    }

    setIsUploading(true)
    try {
      const tagsList = parseTags(tags)
      
      await uploadReceipts(files, {
        category: category || undefined,
        tags: tagsList.length > 0 ? tagsList : undefined,
        notes: notes || undefined
      })
      
      alert(`✅ ${files.length} fiş başarıyla yüklendi!`)
      onSuccess()
    } catch (error) {
      console.error('Yükleme hatası:', error)
      alert('❌ Fişler yüklenemedi')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>📤 Toplu Fiş Yükleme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dosya Seçimi */}
          <div>
            <label className="block text-sm font-semibold mb-2">Fişleri Seçin</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            {files.length > 0 && (
              <p className="text-sm text-green-600 mt-2">
                ✅ {files.length} dosya seçildi
              </p>
            )}
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-sm font-semibold mb-2">Kategori (Opsiyonel)</label>
            <CategorySelect
              value={category}
              onChange={setCategory}
              includeAll={false}
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Etiketler */}
          <div>
            <label className="block text-sm font-semibold mb-2">Etiketler (virgülle ayırın)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="örn: test_set, karmaşık, yüksek_kdv"
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-sm font-semibold mb-2">Notlar (Opsiyonel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bu fişler hakkında notlar..."
              className="w-full p-2 border rounded-md min-h-[80px]"
            />
          </div>

          {/* Butonlar */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isUploading}
            >
              İptal
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {files.length} Fişi Yükle
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Receipt Detail Modal Component  
interface ReceiptDetailModalProps {
  receipt: ReceiptResponse
  onClose: () => void
  onUpdate: () => void
}

const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({ receipt, onClose, onUpdate }) => {
  const [editedReceipt, setEditedReceipt] = useState(receipt)
  const [isSaving, setIsSaving] = useState(false)
  const [groundTruthJson, setGroundTruthJson] = useState(
    receipt.ground_truth_data ? JSON.stringify(receipt.ground_truth_data, null, 2) : ''
  )

  // Gösterilecek görsel path'i
  const imagePath = receipt.is_cropped && receipt.cropped_image_path 
    ? receipt.cropped_image_path 
    : receipt.original_image_path

  const handleSave = async () => {
    setIsSaving(true)
    try {
      let groundTruthData = null
      if (groundTruthJson.trim()) {
        try {
          groundTruthData = JSON.parse(groundTruthJson)
        } catch (e) {
          alert('❌ Ground Truth JSON formatı geçersiz')
          setIsSaving(false)
          return
        }
      }

      await updateReceipt(receipt.id, {
        name: editedReceipt.name,
        description: editedReceipt.description || undefined,
        category: editedReceipt.category || undefined,
        tags: editedReceipt.tags || undefined,
        notes: editedReceipt.notes || undefined,
        ground_truth_data: groundTruthData
      })

      alert('✅ Fiş güncellendi!')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Güncelleme hatası:', error)
      alert('❌ Fiş güncellenemedi')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-4xl w-full my-8">
        <CardHeader>
          <CardTitle>📝 Fiş Detayları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fiş Görseli */}
          {imagePath && (
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Fiş Görseli</label>
              <div className="border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center" style={{ maxHeight: '400px' }}>
                <img 
                  src={imagePath} 
                  alt={receipt.name}
                  className="max-w-full max-h-96 object-contain"
                  onError={(e) => {
                    console.error('Image load error:', imagePath)
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" text-anchor="middle" fill="gray">Görsel yüklenemedi</text></svg>'
                  }}
                />
              </div>
            </div>
          )}

          {/* Fiş Adı */}
          <div>
            <label className="block text-sm font-semibold mb-2">Fiş Adı *</label>
            <input
              type="text"
              value={editedReceipt.name}
              onChange={(e) => setEditedReceipt({ ...editedReceipt, name: e.target.value })}
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-sm font-semibold mb-2">Açıklama</label>
            <input
              type="text"
              value={editedReceipt.description || ''}
              onChange={(e) => setEditedReceipt({ ...editedReceipt, description: e.target.value })}
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-sm font-semibold mb-2">Kategori</label>
            <CategorySelect
              value={editedReceipt.category || ''}
              onChange={(value) => setEditedReceipt({ ...editedReceipt, category: value })}
              includeAll={false}
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-sm font-semibold mb-2">Notlar</label>
            <textarea
              value={editedReceipt.notes || ''}
              onChange={(e) => setEditedReceipt({ ...editedReceipt, notes: e.target.value })}
              className="w-full p-2 border rounded-md min-h-[80px]"
            />
          </div>

          {/* Ground Truth JSON */}
          <div>
            <label className="block text-sm font-semibold mb-2">Ground Truth (JSON)</label>
            <textarea
              value={groundTruthJson}
              onChange={(e) => setGroundTruthJson(e.target.value)}
              placeholder='{"vkn": "1234567890", "grand_total": 1724.82, ...}'
              className="w-full p-2 border rounded-md min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Doğru muhasebe verisini JSON formatında girin
            </p>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded">
            <div>
              <p className="text-xs text-gray-600">Kırpılmış</p>
              <p className="font-semibold">{receipt.is_cropped ? '✅ Evet' : '❌ Hayır'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Ground Truth</p>
              <p className="font-semibold">{receipt.has_ground_truth ? '✅ Var' : '❌ Yok'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Test Sayısı</p>
              <p className="font-semibold">{receipt.test_count}</p>
            </div>
          </div>

          {/* Butonlar */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isSaving}
            >
              İptal
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Kaydet
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Batch Crop Modal Component
interface BatchCropModalProps {
  receipts: ReceiptResponse[]
  onClose: () => void
  onUpdate: () => void
}

const BatchCropModal: React.FC<BatchCropModalProps> = ({ receipts, onClose, onUpdate }) => {
  // Kırpılmamış fişleri filtrele
  const uncroppedReceipts = receipts.filter(r => !r.is_cropped)
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [croppedCount, setCroppedCount] = useState(0)
  const [showCropper, setShowCropper] = useState(false)
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null)

  const currentReceipt = uncroppedReceipts[currentIndex]

  useEffect(() => {
    if (currentReceipt) {
      loadImageFile(currentReceipt)
    }
  }, [currentIndex])

  const loadImageFile = async (receipt: ReceiptResponse) => {
    try {
      const response = await fetch(receipt.original_image_path)
      const blob = await response.blob()
      const file = new File([blob], `${receipt.name}.jpg`, { type: blob.type })
      setCurrentImageFile(file)
      setShowCropper(true)
    } catch (error) {
      console.error('Image load error:', error)
      alert('Görsel yüklenemedi')
    }
  }

  const handleCropComplete = async (_originalFile: File, croppedFile: File, _cropArea: any) => {
    setIsSaving(true)
    try {
      await cropReceipt(currentReceipt.id, croppedFile)
      setCroppedCount(prev => prev + 1)
      
      // Sonraki fişe geç
      if (currentIndex < uncroppedReceipts.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setShowCropper(false)
      } else {
        // Tamamlandı
        alert(`✅ Tüm fişler kırpıldı! (${uncroppedReceipts.length} adet)`)
        onUpdate()
        onClose()
      }
    } catch (error) {
      console.error('Crop error:', error)
      alert('Kırpma işlemi başarısız')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSkip = () => {
    if (currentIndex < uncroppedReceipts.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setShowCropper(false)
    }
  }

  const handleSaveAndExit = () => {
    if (croppedCount > 0) {
      alert(`✅ ${croppedCount} fiş kırpıldı ve kaydedildi`)
      onUpdate()
    }
    onClose()
  }

  if (uncroppedReceipts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>✅ Tüm Fişler Kırpılmış!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Kırpılması gereken fiş bulunmuyor.</p>
            <Button onClick={onClose} className="w-full">Tamam</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-6xl w-full my-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>✂️ Toplu Fiş Kırpma</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {currentIndex + 1} / {uncroppedReceipts.length} - {currentReceipt.name}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSkip}
                variant="outline"
                disabled={isSaving || currentIndex >= uncroppedReceipts.length - 1}
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Atla
              </Button>
              <Button
                onClick={handleSaveAndExit}
                variant="outline"
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                Kaydet & Çık
              </Button>
            </div>
          </div>
          {/* İlerleme Çubuğu */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>İlerleme</span>
              <span>{croppedCount} kırpıldı</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${(croppedCount / uncroppedReceipts.length) * 100}%` }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showCropper && currentImageFile ? (
            <ImageCropper
              imageFile={currentImageFile}
              onCropComplete={handleCropComplete}
              onCancel={handleSkip}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-3">Görsel yükleniyor...</span>
            </div>
          )}

          {/* Bilgi */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 İpucu:</strong> Kırpma alanını ayarlamak için köşe noktalarını sürükleyin. 
              Kaydet butonuna tıklayınca otomatik olarak bir sonraki fişe geçilecek.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Batch Rename Modal Component
interface BatchRenameModalProps {
  receipts: ReceiptResponse[]
  onClose: () => void
  onUpdate: () => void
}

const BatchRenameModal: React.FC<BatchRenameModalProps> = ({ receipts, onClose, onUpdate }) => {
  const [prefix, setPrefix] = useState('test')
  const [startNumber, setStartNumber] = useState(1)
  const [isRenaming, setIsRenaming] = useState(false)
  const [preview, setPreview] = useState<string[]>([])

  useEffect(() => {
    generatePreview()
  }, [prefix, startNumber, receipts])

  const generatePreview = () => {
    const sorted = [...receipts].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const names = sorted.slice(0, 5).map((_, index) => `${prefix}-${startNumber + index}`)
    setPreview(names)
  }

  const handleRename = async () => {
    if (!confirm(`${receipts.length} fişi yeniden adlandırmak istediğinize emin misiniz?`)) return
    
    setIsRenaming(true)
    try {
      // Oluşturulma tarihine göre sırala
      const sorted = [...receipts].sort((a, b) => a.created_at.localeCompare(b.created_at))
      
      let successCount = 0
      for (let i = 0; i < sorted.length; i++) {
        const receipt = sorted[i]
        const newName = `${prefix}-${startNumber + i}`
        
        try {
          await updateReceipt(receipt.id, { name: newName })
          successCount++
        } catch (error) {
          console.error(`Failed to rename ${receipt.id}:`, error)
        }
      }
      
      alert(`✅ ${successCount} fiş başarıyla yeniden adlandırıldı!`)
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Rename error:', error)
      alert('❌ Yeniden adlandırma işlemi başarısız')
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>📝 Toplu Yeniden İsimlendirme</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            {receipts.length} fiş yeniden adlandırılacak
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prefix */}
          <div>
            <label className="block text-sm font-semibold mb-2">Ön Ek (Prefix)</label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="test"
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Start Number */}
          <div>
            <label className="block text-sm font-semibold mb-2">Başlangıç Numarası</label>
            <input
              type="number"
              value={startNumber}
              onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold mb-2">Önizleme (ilk 5 fiş):</p>
            <ul className="space-y-1">
              {preview.map((name, index) => (
                <li key={index} className="text-sm text-gray-700">
                  {index + 1}. {name}
                </li>
              ))}
              {receipts.length > 5 && (
                <li className="text-sm text-gray-500 italic">
                  ... ve {receipts.length - 5} fiş daha
                </li>
              )}
            </ul>
          </div>

          {/* Bilgi */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Not:</strong> Fişler oluşturulma tarihine göre sıralanarak isimlendirilecektir.
              İlk yüklenen fiş "{prefix}-{startNumber}", ikinci "{prefix}-{startNumber + 1}" olacak.
            </p>
          </div>

          {/* Butonlar */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isRenaming}
            >
              İptal
            </Button>
            <Button
              onClick={handleRename}
              disabled={isRenaming || !prefix}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {isRenaming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  İsimlendiriliyor...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {receipts.length} Fişi Yeniden Adlandır
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
