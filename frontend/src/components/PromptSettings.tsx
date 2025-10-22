import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { OCRModelType, MODEL_NAMES } from '@/types'

interface PromptSettingsProps {
  prompt: string
  onPromptChange: (prompt: string) => void
  selectedModels: OCRModelType[]
  onModelsChange: (models: OCRModelType[]) => void
}

export const PromptSettings: React.FC<PromptSettingsProps> = ({
  prompt,
  onPromptChange,
  selectedModels,
  onModelsChange,
}) => {
  const handleModelToggle = (model: OCRModelType) => {
    if (selectedModels.includes(model)) {
      onModelsChange(selectedModels.filter(m => m !== model))
    } else {
      onModelsChange([...selectedModels, model])
    }
  }
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt Ayarları</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="OCR modeline gönderilecek özel prompt..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Not: Sadece OpenAI Vision prompt destekler
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Seçimi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(MODEL_NAMES).map(([key, name]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={key}
                  checked={selectedModels.includes(key as OCRModelType)}
                  onCheckedChange={() => handleModelToggle(key as OCRModelType)}
                />
                <label
                  htmlFor={key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {name}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
