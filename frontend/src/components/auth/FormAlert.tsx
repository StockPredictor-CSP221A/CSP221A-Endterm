import { AlertCircle } from 'lucide-react'

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-loss/25 bg-loss/10 px-3 py-2.5 text-sm text-foreground"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-loss" />
      <p>{message}</p>
    </div>
  )
}
