import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { AccountingData } from '@/types'
import { Building2, Calendar, FileText, CreditCard, TrendingUp, Receipt, Code, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './ui/button'
import { formatCost, formatCostTRY } from '@/lib/formatters'

interface AccountingViewProps {
  data: AccountingData
  processingTime?: number  // GPT işlem süresi (ms)
  ocrProcessingTime?: number  // OCR işlem süresi (ms)
  ocrCost?: number  // OCR maliyeti ($)
  cost?: number  // GPT maliyeti ($)
  rawGptResponse?: string | null
}

export const AccountingView: React.FC<AccountingViewProps> = ({ 
  data, 
  processingTime, 
  ocrProcessingTime,
  ocrCost,
  cost, 
  rawGptResponse 
}) => {
  const [showRawJson, setShowRawJson] = useState(false)
  const USD_TO_TRY = 41.80  // Dolar/TL kuru
  
  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-'
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '-'
    return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="space-y-4">
      {/* Başlık Bilgileri */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.vkn && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <Building2 className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">VKN</p>
                  <p className="font-semibold text-foreground">{data.vkn}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {data.company_name && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <Building2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Firma</p>
                  <p className="font-semibold text-sm text-foreground">{data.company_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {data.date && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Tarih</p>
                  <p className="font-semibold text-foreground">{data.date}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {data.plate && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <Receipt className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Plaka</p>
                  <p className="font-semibold text-foreground">{data.plate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ürün Kalemleri */}
      {data.line_items && data.line_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Ürün/Hizmet Kalemleri ({data.line_items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Ürün/Hizmet</th>
                    <th className="text-right p-2">Miktar</th>
                    <th className="text-right p-2">Birim Fiyat</th>
                    <th className="text-right p-2 text-orange-600">İndirim</th>
                    <th className="text-right p-2">KDV %</th>
                    <th className="text-right p-2">KDV Tutarı</th>
                    <th className="text-right p-2 font-semibold">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {data.line_items.map((item, index) => {
                    const hasDiscount = item.discount_amount && item.discount_amount > 0
                    return (
                      <tr key={index} className="border-t hover:bg-muted/50">
                        <td className="p-2">{item.name}</td>
                        <td className="text-right p-2">{formatNumber(item.quantity)}</td>
                        <td className="text-right p-2">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right p-2">
                          {hasDiscount ? (
                            <span className="text-orange-600 font-semibold">
                              -{formatCurrency(item.discount_amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="text-right p-2">{item.vat_rate ? `${item.vat_rate}%` : '-'}</td>
                        <td className="text-right p-2">{formatCurrency(item.vat_amount)}</td>
                        <td className="text-right p-2 font-semibold">{formatCurrency(item.total_price)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KDV Dökümü - Dual Display */}
      {((data.vat_breakdown_gpt && data.vat_breakdown_gpt.length > 0) || 
        (data.vat_breakdown_calculated && data.vat_breakdown_calculated.length > 0) ||
        (data.vat_breakdown && data.vat_breakdown.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              KDV Dökümü
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              🤖 Üst satır: GPT'den gelen • 📊 Alt satır: Ürün kalemlerinden hesaplanan
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                // Tüm unique VAT oranlarını topla
                const allRates = new Set<number>()
                if (data.vat_breakdown_gpt) {
                  data.vat_breakdown_gpt.forEach(v => allRates.add(v.rate))
                }
                if (data.vat_breakdown_calculated) {
                  data.vat_breakdown_calculated.forEach(v => allRates.add(v.rate))
                }
                // Fallback: eski format
                if (allRates.size === 0 && data.vat_breakdown) {
                  data.vat_breakdown.forEach(v => allRates.add(v.rate))
                }

                return Array.from(allRates).sort((a, b) => a - b).map((rate) => {
                  const gptVat = (data.vat_breakdown_gpt || data.vat_breakdown || []).find(v => v.rate === rate)
                  const calcVat = (data.vat_breakdown_calculated || []).find(v => v.rate === rate)
                  
                  // Farklılıkları tespit et
                  const hasGpt = !!gptVat
                  const hasCalc = !!calcVat
                  const isDifferent = hasGpt && hasCalc && (
                    Math.abs((gptVat.vat_amount || 0) - (calcVat.vat_amount || 0)) > 0.01
                  )

                  return (
                    <div key={rate} className={`border rounded-lg p-4 ${
                      isDifferent 
                        ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-300 dark:border-orange-700' 
                        : 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-blue-700 dark:text-blue-400">%{rate} KDV</span>
                        {isDifferent && (
                          <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full font-semibold">
                            ⚠️ Farklılık var
                          </span>
                        )}
                      </div>
                      
                      {/* GPT'den gelen (üst satır) */}
                      {hasGpt && (
                        <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">🤖 GPT</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Matrah</p>
                              <p className="font-semibold">{formatCurrency(gptVat.base_amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">KDV Tutarı</p>
                              <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(gptVat.vat_amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">KDV Dahil</p>
                              <p className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(gptVat.total_amount)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Hesaplanan (alt satır) */}
                      {hasCalc && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">📊 Hesaplanan</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Matrah</p>
                              <p className="font-semibold">{formatCurrency(calcVat.base_amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">KDV Tutarı</p>
                              <p className={`font-semibold ${
                                isDifferent 
                                  ? 'text-orange-600 dark:text-orange-400' 
                                  : 'text-green-600 dark:text-green-400'
                              }`}>
                                {formatCurrency(calcVat.vat_amount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">KDV Dahil</p>
                              <p className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(calcVat.total_amount)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toplam Bilgileri - Dual Display */}
      <Card className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Toplam Değerler
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            🤖 Üst satır: GPT'den gelen • 📊 Alt satır: Ürün kalemlerinden hesaplanan
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ara Toplam (KDV Hariç) */}
            {((data.subtotal_gpt !== undefined && data.subtotal_gpt !== null) || 
              (data.subtotal_calculated !== undefined && data.subtotal_calculated !== null) ||
              (data.subtotal !== undefined && data.subtotal !== null)) && (
              <div className={`border rounded-lg p-4 ${
                Math.abs((data.subtotal_gpt || data.subtotal || 0) - (data.subtotal_calculated || 0)) > 0.02
                  ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-300 dark:border-orange-700'
                  : 'bg-white dark:bg-gray-900'
              }`}>
                <p className="text-sm text-muted-foreground mb-3">Ara Toplam (KDV Hariç)</p>
                
                {/* GPT'den gelen */}
                {(data.subtotal_gpt !== undefined || data.subtotal !== undefined) && (
                  <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">🤖 GPT</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(data.subtotal_gpt || data.subtotal)}
                    </p>
                  </div>
                )}
                
                {/* Hesaplanan */}
                {data.subtotal_calculated !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">📊 Hesaplanan</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(data.subtotal_calculated)}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Toplam KDV */}
            {((data.total_vat_gpt !== undefined && data.total_vat_gpt !== null) || 
              (data.total_vat_calculated !== undefined && data.total_vat_calculated !== null) ||
              (data.total_vat !== undefined && data.total_vat !== null)) && (
              <div className={`border rounded-lg p-4 ${
                Math.abs((data.total_vat_gpt || data.total_vat || 0) - (data.total_vat_calculated || 0)) > 0.02
                  ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-300 dark:border-orange-700'
                  : 'bg-white dark:bg-gray-900'
              }`}>
                <p className="text-sm text-muted-foreground mb-3">Toplam KDV</p>
                
                {/* GPT'den gelen */}
                {(data.total_vat_gpt !== undefined || data.total_vat !== undefined) && (
                  <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">🤖 GPT</span>
                    </div>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(data.total_vat_gpt || data.total_vat)}
                    </p>
                  </div>
                )}
                
                {/* Hesaplanan */}
                {data.total_vat_calculated !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">📊 Hesaplanan</span>
                    </div>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(data.total_vat_calculated)}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Genel Toplam (KDV Dahil) */}
            {((data.grand_total_gpt !== undefined && data.grand_total_gpt !== null) || 
              (data.grand_total_calculated !== undefined && data.grand_total_calculated !== null) ||
              (data.grand_total !== undefined && data.grand_total !== null)) && (
              <div className={`border rounded-lg p-4 ${
                Math.abs((data.grand_total_gpt || data.grand_total || 0) - (data.grand_total_calculated || 0)) > 0.02
                  ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-300 dark:border-orange-700'
                  : 'bg-white dark:bg-gray-900'
              }`}>
                <p className="text-sm text-muted-foreground mb-3">Genel Toplam (KDV Dahil)</p>
                
                {/* GPT'den gelen */}
                {(data.grand_total_gpt !== undefined || data.grand_total !== undefined) && (
                  <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">🤖 GPT</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(data.grand_total_gpt || data.grand_total)}
                    </p>
                  </div>
                )}
                
                {/* Hesaplanan */}
                {data.grand_total_calculated !== undefined && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">📊 Hesaplanan</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(data.grand_total_calculated)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {data.payment_method && (
            <div className="mt-4 pt-4 border-t flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ödeme Yöntemi:</span>
              <span className="font-semibold">{data.payment_method}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* İşlem Bilgileri - Maliyet ve Süre */}
      {(processingTime || ocrProcessingTime || cost || ocrCost) && (
        <Card className="border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-blue-700 dark:text-blue-400">
              📊 Analiz Performansı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Toplam Süre */}
              {(processingTime || ocrProcessingTime) && (
                <div className="bg-card rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-muted-foreground mb-1">⏱️ Toplam İşlem Süresi</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {(((ocrProcessingTime || 0) + (processingTime || 0)) / 1000).toFixed(2)} sn
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {ocrProcessingTime && <p>OCR: {(ocrProcessingTime / 1000).toFixed(2)} sn</p>}
                    {processingTime && <p>GPT: {(processingTime / 1000).toFixed(2)} sn</p>}
                  </div>
                </div>
              )}

              {/* OCR Maliyeti */}
              {ocrCost !== undefined && (
                <div className="bg-card rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-muted-foreground mb-1">🔍 OCR Maliyet</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCost(ocrCost)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    OCR analiz ücreti
                  </p>
                </div>
              )}

              {/* GPT Maliyeti */}
              {cost !== undefined && (
                <div className="bg-card rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-muted-foreground mb-1">🤖 GPT Maliyet</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCost(cost)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Muhasebe analiz ücreti
                  </p>
                </div>
              )}

              {/* Toplam Maliyet (USD) */}
              {(cost !== undefined || ocrCost !== undefined) && (
                <div className="bg-card rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground mb-1">💵 Toplam (USD)</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCost((ocrCost || 0) + (cost || 0))}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    OCR + GPT toplamı
                  </p>
                </div>
              )}

              {/* Toplam Maliyet (TL) */}
              {(cost !== undefined || ocrCost !== undefined) && (
                <div className="bg-card rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                  <p className="text-xs text-muted-foreground mb-1">💰 Toplam (TRY)</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {formatCostTRY((ocrCost || 0) + (cost || 0))}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kur: $1 = ₺{USD_TO_TRY}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw GPT Response (JSON) */}
      {rawGptResponse && (
        <Card className="mt-4 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Code className="w-4 h-4 text-purple-600" />
                GPT Ham Yanıtı (JSON)
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRawJson(!showRawJson)}
                className="h-8 text-xs"
              >
                {showRawJson ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Gizle
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Göster
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showRawJson && (
            <CardContent>
              <pre className="bg-gray-900 dark:bg-gray-950 text-green-400 dark:text-green-300 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
                {JSON.stringify(JSON.parse(rawGptResponse), null, 2)}
              </pre>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(rawGptResponse)
                    alert('✅ JSON kopyalandı!')
                  }}
                  className="text-xs"
                >
                  📋 Kopyala
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([rawGptResponse], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `gpt-response-${Date.now()}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="text-xs"
                >
                  💾 İndir
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
