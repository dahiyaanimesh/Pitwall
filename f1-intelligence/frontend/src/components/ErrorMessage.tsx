import { AlertTriangle } from 'lucide-react'

interface ErrorMessageProps {
  message: string
  onRetry?: () => void
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-5 py-4"
      style={{
        background: 'rgba(225,6,0,0.06)',
        border: '1px solid rgba(225,6,0,0.2)',
      }}
    >
      <AlertTriangle size={16} className="text-f1red mt-0.5 flex-shrink-0" strokeWidth={1.8} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/70 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-f1red hover:text-white transition-colors flex-shrink-0 font-medium"
        >
          Retry
        </button>
      )}
    </div>
  )
}
