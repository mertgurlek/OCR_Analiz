import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { OCRResult, MODEL_NAMES } from '@/types'
import { Clock, DollarSign, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCost } from '@/lib/formatters'

interface ResultCardProps {
  result: OCRResult
  isCorrect?: boolean
  onToggleCorrect?: (modelName: string) => void
}

export const ResultCard: React.FC<ResultCardProps> = ({ 
  result, 
  isCorrect, 
  onToggleCorrect 
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const modelName = MODEL_NAMES[result.model_name] || result.model_name
  
  return (
    <Card className={isCorrect ? 'border-green-500 border-2' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {modelName}
              {result.error && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  Hata
                </span>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              <div className="flex items-center gap-4 text-xs mt-2">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{result.processing_time_ms.toFixed(0)}ms</span>
                </div>
                
                {result.estimated_cost !== undefined && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span>{formatCost(result.estimated_cost)}</span>
                  </div>
                )}
                
                {result.confidence_score !== undefined && (
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    <span>{(result.confidence_score * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </CardDescription>
          </div>
          
          {onToggleCorrect && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isCorrect}
                onCheckedChange={() => onToggleCorrect(result.model_name)}
              />
              <span className="text-sm text-gray-600">Doğru</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {result.error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-700">{result.error}</p>
          </div>
        ) : (
          <>
            {/* Text Preview */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Çıkarılan Metin:</h4>
              <div className="bg-gray-50 rounded-md p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {result.text_content.substring(0, 300)}
                  {result.text_content.length > 300 && '...'}
                </pre>
              </div>
            </div>
            
            {/* Structured Data */}
            {result.structured_data && Object.keys(result.structured_data).length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between mb-2"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <span className="text-sm font-semibold">
                    Yapılandırılmış Veri ({Object.keys(result.structured_data).length} alan)
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                
                {isExpanded && (
                  <div className="bg-gray-50 rounded-md p-3 max-h-64 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {JSON.stringify(result.structured_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
