import { useState } from 'react'

interface UseImageModalReturn {
  showModal: boolean
  imageScale: number
  openModal: () => void
  closeModal: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

/**
 * Image modal ve zoom state management hook
 * Görsel büyütme/küçültme özelliği olan tüm componentlerde kullanılır
 */
export const useImageModal = (): UseImageModalReturn => {
  const [showModal, setShowModal] = useState(false)
  const [imageScale, setImageScale] = useState(1)

  const openModal = () => setShowModal(true)

  const closeModal = () => {
    setShowModal(false)
    // Modal kapanırken zoom'u resetle
    setTimeout(() => setImageScale(1), 300)
  }

  const zoomIn = () => {
    setImageScale(prev => Math.min(prev + 0.25, 3)) // Max 3x zoom
  }

  const zoomOut = () => {
    setImageScale(prev => Math.max(prev - 0.25, 0.5)) // Min 0.5x zoom
  }

  const resetZoom = () => {
    setImageScale(1)
  }

  return {
    showModal,
    imageScale,
    openModal,
    closeModal,
    zoomIn,
    zoomOut,
    resetZoom
  }
}
