import { useState } from 'react'

interface UseFileUploadReturn {
  selectedFile: File | null
  croppedFile: File | null
  showCropper: boolean
  selectFile: (file: File) => void
  cropFile: (file: File) => void
  clearFiles: () => void
  setShowCropper: (show: boolean) => void
}

/**
 * File upload ve kırpma state management hook
 * SingleModelTest, FileUpload gibi componentlerde kullanılır
 */
export const useFileUpload = (): UseFileUploadReturn => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [croppedFile, setCroppedFile] = useState<File | null>(null)
  const [showCropper, setShowCropper] = useState(false)

  const selectFile = (file: File) => {
    setSelectedFile(file)
    setCroppedFile(null) // Yeni dosya seçilince kırpılmış dosyayı temizle
  }

  const cropFile = (file: File) => {
    setCroppedFile(file)
    setShowCropper(false)
  }

  const clearFiles = () => {
    setSelectedFile(null)
    setCroppedFile(null)
    setShowCropper(false)
  }

  return {
    selectedFile,
    croppedFile,
    showCropper,
    selectFile,
    cropFile,
    clearFiles,
    setShowCropper
  }
}
