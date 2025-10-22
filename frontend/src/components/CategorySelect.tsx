import React from 'react'

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  includeAll?: boolean
  className?: string
  disabled?: boolean
}

const PREDEFINED_CATEGORIES = [
  'akaryakit',
  'market',
  'restoran',
  'taksi',
  'eczane',
  'konaklama',
  'diger'
]

/**
 * Kategori seçim dropdown component'i
 * Tüm kategori dropdown'larını tek bir component'te birleştirdik
 */
export const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  onChange,
  includeAll = true,
  className = 'px-3 py-2 border border-border rounded-md bg-background text-foreground',
  disabled = false
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled}
    >
      {includeAll && <option value="">Tüm Kategoriler</option>}
      {!includeAll && <option value="">Seçiniz...</option>}
      {PREDEFINED_CATEGORIES.map(cat => (
        <option key={cat} value={cat}>
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </option>
      ))}
    </select>
  )
}

/**
 * Kategori listesini export et (başka yerlerde kullanılabilir)
 */
export { PREDEFINED_CATEGORIES as CATEGORIES }
