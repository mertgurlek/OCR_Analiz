import { MODEL_NAMES } from '@/types'

/**
 * Model key'den display name'e çevir
 * @param modelKey - Model key'i (örn: "google_docai")
 * @returns Display name (örn: "📄 Google Document AI")
 */
export function getModelDisplayName(modelKey: string): string {
  return MODEL_NAMES[modelKey as keyof typeof MODEL_NAMES] || modelKey
}

/**
 * Birden fazla model key'i display name'lere çevir
 * @param modelKeys - Model key'lerinin array'i
 * @returns Display name'lerin array'i
 */
export function getModelDisplayNames(modelKeys: string[]): string[] {
  return modelKeys.map(getModelDisplayName)
}

/**
 * Model display name'lerini virgülle birleştir
 * @param modelKeys - Model key'lerinin array'i
 * @returns Virgülle ayrılmış display name'ler (örn: "GPT-4, Google DocAI")
 */
export function formatModelNames(modelKeys: string[]): string {
  return getModelDisplayNames(modelKeys).join(', ')
}

/**
 * Model key'den emoji çıkar
 * @param modelKey - Model key'i
 * @returns Sadece emoji kısmı (örn: "📄")
 */
export function getModelEmoji(modelKey: string): string {
  const displayName = getModelDisplayName(modelKey)
  const emojiMatch = displayName.match(/[\p{Emoji}]/u)
  return emojiMatch ? emojiMatch[0] : ''
}

/**
 * Model key'den emoji'siz isim çıkar
 * @param modelKey - Model key'i
 * @returns Emoji'siz isim (örn: "Google Document AI")
 */
export function getModelNameWithoutEmoji(modelKey: string): string {
  const displayName = getModelDisplayName(modelKey)
  return displayName.replace(/[\p{Emoji}\s]/gu, '').trim()
}
