interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = 'Loading data…' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      {/* Telemetry-style spinner */}
      <div className="relative w-10 h-10">
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: '1px solid rgba(225,6,0,0.15)' }}
        />
        {/* Spinning arc */}
        <div
          className="absolute inset-0 rounded-full animate-spin-slow"
          style={{
            background: 'conic-gradient(from 0deg, #E10600 0%, #E10600 25%, transparent 25%)',
            WebkitMask: 'radial-gradient(circle, transparent 60%, black 61%)',
            mask: 'radial-gradient(circle, transparent 60%, black 61%)',
          }}
        />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-f1red animate-pulse-soft" />
        </div>
      </div>
      <p className="section-label">{message}</p>
    </div>
  )
}
