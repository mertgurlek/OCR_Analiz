import { ReceiptResponse } from '@/api/client'

/**
 * Fişleri arama terimi ve kategoriye göre filtreler
 * @param receipts - Filtrelenecek fiş listesi
 * @param searchTerm - Arama terimi (isim, açıklama, kategori)
 * @param category - Kategori filtresi (opsiyonel)
 * @returns Filtrelenmiş fiş listesi
 */
export function filterReceipts(
  receipts: ReceiptResponse[],
  searchTerm: string = '',
  category: string = ''
): ReceiptResponse[] {
  return receipts.filter(receipt => {
    // Arama terimi kontrolü
    const matchesSearch = !searchTerm || 
      receipt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.category?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Kategori kontrolü
    const matchesCategory = !category || receipt.category === category
    
    return matchesSearch && matchesCategory
  })
}

/**
 * Benzersiz kategorileri çıkarır
 * @param receipts - Fiş listesi
 * @returns Benzersiz kategori listesi
 */
export function getUniqueCategories(receipts: ReceiptResponse[]): string[] {
  const categories = new Set<string>()
  receipts.forEach(receipt => {
    if (receipt.category) {
      categories.add(receipt.category)
    }
  })
  return Array.from(categories).sort()
}
