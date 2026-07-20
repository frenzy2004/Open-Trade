import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type ToastTone = 'info' | 'success' | 'warning'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  addToast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    const timers = timersRef.current

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  const addToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextIdRef.current
    nextIdRef.current += 1
    setToasts((current) => [...current, { id, message, tone }])
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
      const timerIndex = timersRef.current.indexOf(timer)
      if (timerIndex !== -1) {
        timersRef.current.splice(timerIndex, 1)
      }
    }, 4000)
    timersRef.current.push(timer)
  }, [])

  const value = useMemo(() => ({ addToast }), [addToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className={'ui-toast ui-toast--' + toast.tone}
            key={toast.id}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// The public hook must share this module's private context with ToastProvider.
// eslint-disable-next-line react-refresh/only-export-components
export function useToasts(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) {
    throw new Error('useToasts must be used within ToastProvider')
  }
  return context
}
