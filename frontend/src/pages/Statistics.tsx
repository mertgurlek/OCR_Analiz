import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPromptTestStatistics, PromptTestStatistics } from '@/api/client'
import { BarChart3, TrendingUp, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { getModelDisplayName } from '@/lib/modelUtils'

export const Statistics: React.FC = () => {
  const [statistics, setStatistics] = useState<PromptTestStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    setIsLoading(true)
    try {
      const stats = await getPromptTestStatistics()
      setStatistics(stats)
    } catch (error) {
      console.error('İstatistik yükleme hatası:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!statistics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">İstatistik yüklenemedi</p>
      </div>
    )
  }

  const calculateAccuracy = (correct: number, total: number) => {
    if (total === 0) return 0
    return ((correct / total) * 100).toFixed(1)
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Test İstatistikleri</h1>
      </div>

      {/* Genel Özet */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-600">{statistics.total_tests}</p>
              <p className="text-sm text-gray-600 mt-1">Toplam Test</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-600">{statistics.labeled_tests}</p>
              <p className="text-sm text-gray-600 mt-1">Etiketlenmiş</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-purple-600">{statistics.correct_tests}</p>
              <p className="text-sm text-gray-600 mt-1">Doğru</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-orange-600">
                {calculateAccuracy(statistics.correct_tests, statistics.labeled_tests)}%
              </p>
              <p className="text-sm text-gray-600 mt-1">Başarı Oranı</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Bazlı İstatistikler */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Model Bazlı Performans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Model</th>
                  <th className="text-center py-3 px-4 font-semibold">Toplam Test</th>
                  <th className="text-center py-3 px-4 font-semibold">Etiketlenmiş</th>
                  <th className="text-center py-3 px-4 font-semibold">✅ Doğru</th>
                  <th className="text-center py-3 px-4 font-semibold">❌ Yanlış</th>
                  <th className="text-center py-3 px-4 font-semibold">⚠️ Kısmi</th>
                  <th className="text-center py-3 px-4 font-semibold">Başarı %</th>
                  <th className="text-center py-3 px-4 font-semibold">🔍 OCR Hata</th>
                  <th className="text-center py-3 px-4 font-semibold">🤖 GPT Hata</th>
                  <th className="text-center py-3 px-4 font-semibold">Ort. Süre</th>
                  <th className="text-center py-3 px-4 font-semibold">OCR Maliyet</th>
                  <th className="text-center py-3 px-4 font-semibold">GPT Maliyet</th>
                  <th className="text-center py-3 px-4 font-semibold">Ort. Maliyet (TL)</th>
                </tr>
              </thead>
              <tbody>
                {statistics.model_stats.map((model) => (
                  <tr key={model.model_name} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-4">
                      <span className="font-medium">{getModelDisplayName(model.model_name)}</span>
                    </td>
                    <td className="text-center py-3 px-4">{model.total_tests}</td>
                    <td className="text-center py-3 px-4">{model.labeled_tests}</td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        {model.correct_tests}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                        <XCircle className="w-4 h-4" />
                        {model.incorrect_tests}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
                        <AlertTriangle className="w-4 h-4" />
                        {model.partial_tests}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-bold ${
                        parseFloat(calculateAccuracy(model.correct_tests, model.labeled_tests).toString()) >= 80 
                          ? 'text-green-600' 
                          : parseFloat(calculateAccuracy(model.correct_tests, model.labeled_tests).toString()) >= 60
                          ? 'text-orange-600'
                          : 'text-red-600'
                      }`}>
                        {calculateAccuracy(model.correct_tests, model.labeled_tests)}%
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-red-700 font-semibold">{model.ocr_errors}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-blue-700 font-semibold">{model.gpt_errors}</span>
                    </td>
                    <td className="text-center py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {model.avg_processing_time_ms.toFixed(0)}ms
                    </td>
                    <td className="text-center py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                      ${model.avg_ocr_cost.toFixed(6)}
                    </td>
                    <td className="text-center py-3 px-4 text-sm font-medium text-purple-600 dark:text-purple-400">
                      ${model.avg_gpt_cost.toFixed(6)}
                    </td>
                    <td className="text-center py-3 px-4 text-sm font-bold text-green-600 dark:text-green-400">
                      ₺{((model.avg_ocr_cost + model.avg_gpt_cost) * 41.80).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Hata Tipi Dağılımı */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Hata Tipi Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{statistics.ocr_errors}</p>
              <p className="text-sm text-gray-600 mt-1">OCR Hatası</p>
              <p className="text-xs text-gray-500 mt-1">
                {statistics.labeled_tests > 0 ? ((statistics.ocr_errors / statistics.labeled_tests) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{statistics.gpt_errors}</p>
              <p className="text-sm text-gray-600 mt-1">GPT Hatası</p>
              <p className="text-xs text-gray-500 mt-1">
                {statistics.labeled_tests > 0 ? ((statistics.gpt_errors / statistics.labeled_tests) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">{statistics.both_errors}</p>
              <p className="text-sm text-gray-600 mt-1">Her İkisi</p>
              <p className="text-xs text-gray-500 mt-1">
                {statistics.labeled_tests > 0 ? ((statistics.both_errors / statistics.labeled_tests) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{statistics.no_errors}</p>
              <p className="text-sm text-gray-600 mt-1">Hatasız</p>
              <p className="text-xs text-gray-500 mt-1">
                {statistics.labeled_tests > 0 ? ((statistics.no_errors / statistics.labeled_tests) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model x Prompt Performans Matrisi */}
      {statistics.model_prompt_stats && statistics.model_prompt_stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Model x Prompt Kombinasyon Performansı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Model</th>
                    <th className="text-center py-3 px-4 font-semibold">Prompt V.</th>
                    <th className="text-center py-3 px-4 font-semibold">Toplam Test</th>
                    <th className="text-center py-3 px-4 font-semibold">Etiketlenmiş</th>
                    <th className="text-center py-3 px-4 font-semibold">✅ Doğru</th>
                    <th className="text-center py-3 px-4 font-semibold">❌ Yanlış</th>
                    <th className="text-center py-3 px-4 font-semibold">⚠️ Kısmi</th>
                    <th className="text-center py-3 px-4 font-semibold">Başarı Oranı</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.model_prompt_stats
                    .sort((a, b) => {
                      if (a.model_name !== b.model_name) {
                        return a.model_name.localeCompare(b.model_name)
                      }
                      return a.prompt_version - b.prompt_version
                    })
                    .map((item) => (
                      <tr key={`${item.model_name}-${item.prompt_version}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4">
                          <span className="font-medium">{getModelDisplayName(item.model_name)}</span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-semibold">
                            v{item.prompt_version}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4">{item.total_tests}</td>
                        <td className="text-center py-3 px-4">{item.labeled_tests}</td>
                        <td className="text-center py-3 px-4">
                          <span className="text-green-600 font-semibold">{item.correct_tests}</span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="text-red-600 font-semibold">{item.incorrect_tests}</span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="text-orange-600 font-semibold">{item.partial_tests}</span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className={`font-bold text-lg ${
                            item.accuracy_rate >= 80 
                              ? 'text-green-600' 
                              : item.accuracy_rate >= 60
                              ? 'text-orange-600'
                              : 'text-red-600'
                          }`}>
                            {item.accuracy_rate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
