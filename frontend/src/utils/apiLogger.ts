/**
 * API Logger Utility
 * API isteklerini ve yanıtlarını loglama için merkezi utility
 * Production'da otomatik olarak kapalı
 */

export class ApiLogger {
  private static isDev = import.meta.env.MODE === 'development'

  /**
   * API isteğini logla
   */
  static logRequest(endpoint: string, params?: any) {
    if (!this.isDev) return

    console.log(
      `%c🚀 API Request: ${endpoint}`,
      'color: #3b82f6; font-weight: bold',
      params || ''
    )
  }

  /**
   * API yanıtını logla
   */
  static logResponse(endpoint: string, data: any) {
    if (!this.isDev) return

    console.log(
      `%c✅ API Response: ${endpoint}`,
      'color: #10b981; font-weight: bold',
      data
    )
  }

  /**
   * API hatasını logla (production'da da çalışır)
   */
  static logError(endpoint: string, error: any) {
    console.error(
      `%c❌ API Error: ${endpoint}`,
      'color: #ef4444; font-weight: bold',
      {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      }
    )
  }

  /**
   * Detaylı debug log (sadece development)
   */
  static debug(message: string, data?: any) {
    if (!this.isDev) return

    console.log(
      `%c🔍 ${message}`,
      'color: #8b5cf6; font-weight: bold',
      data || ''
    )
  }

  /**
   * Performance log
   */
  static logPerformance(operation: string, duration: number) {
    if (!this.isDev) return

    const color = duration < 1000 ? '#10b981' : duration < 3000 ? '#f59e0b' : '#ef4444'
    console.log(
      `%c⏱️  ${operation}: ${duration}ms`,
      `color: ${color}; font-weight: bold`
    )
  }
}
