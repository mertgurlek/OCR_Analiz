/**
 * Maliyet ve para birimi formatlama yardımcı fonksiyonları
 */

const USD_TO_TRY = 41.80 // Dolar/TL kuru

/**
 * USD maliyetini cent olarak formatlar (x100, 2 ondalık)
 * Örnek: 0.001500 → "$0.15 (×100)"
 */
export function formatCost(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '-'
  
  // x100 yaparak cent'e çevir, 2 ondalık basamak göster
  const centAmount = amount * 100
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centAmount)
  
  return `${formatted} (×100)`
}

/**
 * USD maliyetini TRY'ye çevirip cent olarak formatlar (x100, 2 ondalık)
 * Örnek: 0.001500 → "₺6.27 (×100)"
 */
export function formatCostTRY(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '-'
  
  // x100 yaparak cent'e çevir, sonra TRY'ye çevir
  const centAmount = amount * 100
  const tryAmount = centAmount * USD_TO_TRY
  
  const formatted = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(tryAmount)
  
  return `${formatted} (×100)`
}

/**
 * Normal currency formatı (x100 YAPMA - fiş tutarları için)
 * Örnek: 223.77 → "223,77 ₺"
 */
export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '-'
  
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Sayı formatı (miktar vb. için)
 */
export function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return '-'
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}
