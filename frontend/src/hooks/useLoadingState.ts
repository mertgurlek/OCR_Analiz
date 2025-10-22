import { useState } from 'react'

export type LoadingStateKey = 
  | 'analyzing' 
  | 'saving' 
  | 'loading' 
  | 'savingPrompt'
  | 'loadingPrompt'
  | 'loadingAccounting'
  | 'savingTest'
  | 'loadingHistory'

interface LoadingStates {
  analyzing: boolean
  saving: boolean
  loading: boolean
  savingPrompt: boolean
  loadingPrompt: boolean
  loadingAccounting: boolean
  savingTest: boolean
  loadingHistory: boolean
}

interface UseLoadingStateReturn extends LoadingStates {
  setLoading: (key: LoadingStateKey, value: boolean) => void
  isAnyLoading: boolean
  resetAllLoading: () => void
}

/**
 * Loading state management hook
 * Birden fazla loading durumunu tek yerden yönetir
 */
export const useLoadingState = (): UseLoadingStateReturn => {
  const [states, setStates] = useState<LoadingStates>({
    analyzing: false,
    saving: false,
    loading: false,
    savingPrompt: false,
    loadingPrompt: false,
    loadingAccounting: false,
    savingTest: false,
    loadingHistory: false
  })

  const setLoading = (key: LoadingStateKey, value: boolean) => {
    setStates(prev => ({ ...prev, [key]: value }))
  }

  const isAnyLoading = Object.values(states).some(state => state === true)

  const resetAllLoading = () => {
    setStates({
      analyzing: false,
      saving: false,
      loading: false,
      savingPrompt: false,
      loadingPrompt: false,
      loadingAccounting: false,
      savingTest: false,
      loadingHistory: false
    })
  }

  return {
    ...states,
    setLoading,
    isAnyLoading,
    resetAllLoading
  }
}
