/**
 * Debug Logger Utility
 * Production'da otomatik olarak console.log'ları devre dışı bırakır
 */

const isDev = import.meta.env.DEV

export const logger = {
  /**
   * Bilgi mesajı - sadece development'ta gösterilir
   */
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`ℹ️ ${message}`, ...args)
    }
  },

  /**
   * Hata mesajı - her zaman gösterilir (production'da da önemli)
   */
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args)
  },

  /**
   * Uyarı mesajı - sadece development'ta gösterilir
   */
  warn: (message: string, ...args: any[]) => {
    if (isDev) {
      console.warn(`⚠️ ${message}`, ...args)
    }
  },

  /**
   * Debug mesajı - sadece development'ta gösterilir
   */
  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.debug(`🐛 ${message}`, ...args)
    }
  },

  /**
   * Aşama bazlı debug - işlem adımlarını takip için
   */
  stage: (stage: number, message: string, data?: any) => {
    if (isDev) {
      console.log(`🎯 AŞAMA ${stage}: ${message}`, data !== undefined ? data : '')
    }
  },

  /**
   * Component render debug - component lifecycle için
   */
  render: (componentName: string, props?: any) => {
    if (isDev) {
      console.log(`🚀 ${componentName} component render edildi`, props !== undefined ? props : '')
    }
  },

  /**
   * State değişikliği debug
   */
  state: (stateName: string, value: any) => {
    if (isDev) {
      console.log(`📊 State güncellendi: ${stateName}`, value)
    }
  },

  /**
   * API çağrısı debug
   */
  api: (method: string, endpoint: string, data?: any) => {
    if (isDev) {
      console.log(`🌐 API ${method}: ${endpoint}`, data !== undefined ? data : '')
    }
  },

  /**
   * Success mesajı
   */
  success: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`✅ ${message}`, ...args)
    }
  }
}
