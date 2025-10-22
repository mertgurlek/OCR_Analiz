import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { AnalysisHistory } from '@/types'
import { getHistory } from '@/api/client'
import { Clock, FileText, DollarSign, CheckCircle } from 'lucide-react'
import { format, parseISO, addHours } from 'date-fns'
import { formatCost } from '@/lib/formatters'
import { formatModelNames } from '@/lib/modelUtils'

interface HistoryPanelProps {
  onSelectAnalysis?: (analysisId: string) => void
  refreshTrigger?: number
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onSelectAnalysis, refreshTrigger }) => {
  const [history, setHistory] = useState<AnalysisHistory[]>([])
  const [loading, setLoading] = useState(false)
  
  const loadHistory = async () => {
    setLoading(true)
    try {
      console.log('🔄 History yükleniyor...')
      const data = await getHistory(20)
      console.log('✅ History yüklendi:', { count: data.length, data })
      setHistory(data)
    } catch (error) {
      console.error('❌ History yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadHistory()
  }, [])
  
  // refreshTrigger değiştiğinde history'yi yeniden yükle
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log('🔄 RefreshTrigger değişti, history yenileniyor...', refreshTrigger)
      loadHistory()
    }
  }, [refreshTrigger])
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Analiz Geçmişi</CardTitle>
        <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loading}>
          Yenile
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Henüz analiz yapılmamış
            </p>
          ) : (
            history.map((item) => (
              <div
                key={item.analysis_id}
                className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onSelectAnalysis?.(item.analysis_id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {item.file_name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{format(addHours(parseISO(item.timestamp), 3), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>{formatCost(item.total_cost)}</span>
                      </div>
                    </div>
                    
                    {item.evaluated && item.correct_models && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>
                          Doğru: {formatModelNames(item.correct_models)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
