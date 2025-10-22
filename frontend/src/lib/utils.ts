import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Tag string'ini parse edip array'e çevirir
 * @param tagsString - Virgülle ayrılmış tag string'i (örn: "tag1, tag2, tag3")
 * @returns Temizlenmiş tag array'i
 */
export function parseTags(tagsString: string): string[] {
  if (!tagsString || !tagsString.trim()) {
    return []
  }
  
  return tagsString
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)
}
