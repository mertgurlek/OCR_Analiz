import React, { useCallback, useState, useRef } from 'react'
import { Upload, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageCropper } from './ImageCropper'

interface FileUploadProps {
  onFileSelect: (file: File, croppedFile?: File, cropData?: any) => void
  isLoading?: boolean
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [showCropper, setShowCropper] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      setSelectedFile(files[0])
      setShowCropper(true)
    }
  }, [])
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 DOSYA SEÇİLDİ - handleFileChange tetiklendi')
    const files = e.target.files
    console.log('📂 Seçilen dosya sayısı:', files?.length || 0)
    if (files && files.length > 0) {
      console.log('📄 Dosya:', files[0].name, files[0].size, 'bytes')
      setSelectedFile(files[0])
      setShowCropper(true)
      console.log('✅ ImageCropper açılıyor...')
    }
  }, [])

  const handleCropComplete = useCallback((originalFile: File, croppedFile: File, cropArea: CropArea) => {
    console.log('✂️ KIRPMA TAMAMLANDI')
    console.log('📁 Dosya bilgileri:', {
      original: { name: originalFile.name, size: originalFile.size },
      cropped: { name: croppedFile.name, size: croppedFile.size },
      cropArea: cropArea
    })
    
    setShowCropper(false)
    setSelectedFile(null)
    
    // Tüm file input'ları resetle
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
    
    console.log('📤 onFileSelect çağrılıyor...')
    onFileSelect(originalFile, croppedFile, cropArea)
  }, [onFileSelect])

  const handleCropCancel = useCallback(() => {
    setShowCropper(false)
    setSelectedFile(null)
    
    // Tüm file input'ları resetle
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
  }, [])

  const handleContainerClick = useCallback(() => {
    if (!isLoading && !showCropper) {
      fileInputRef.current?.click()
    }
  }, [isLoading, showCropper])
  
  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        isLoading && "opacity-50 pointer-events-none"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleContainerClick}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <Upload className="w-8 h-8 text-muted-foreground" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-1">
            Tek katmanlı analiz için belge yükleyin
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Dosyaları sürükleyin veya tıklayarak seçin (JPEG, PNG, GIF, WebP, BMP, TIFF)
          </p>
          <p className="text-xs text-muted-foreground opacity-75">
            Maksimum dosya boyutu: 20MB
          </p>
        </div>
        
        <div className="flex gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-md text-sm font-medium hover:bg-secondary cursor-pointer transition-colors" onClick={(e) => e.stopPropagation()}>
            <Camera className="w-4 h-4" />
            Kamera ile Çek
            <input
              ref={cameraInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              disabled={isLoading}
            />
          </label>
          
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 cursor-pointer transition-colors" onClick={(e) => e.stopPropagation()}>
            <Upload className="w-4 h-4" />
            GPT Ayarları
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/tiff"
              onChange={handleFileChange}
              disabled={isLoading}
            />
          </label>
        </div>
      </div>
      
      {showCropper && selectedFile && (
        <ImageCropper
          imageFile={selectedFile}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}
