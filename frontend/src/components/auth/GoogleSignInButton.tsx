import { useEffect, useRef, useState } from 'react'

import { loadGoogleIdentity } from '@/lib/google-identity'

interface GoogleSignInButtonProps {
  clientId: string
  text: 'signin_with' | 'signup_with'
  onCredential: (credential: string) => void
  onError: (message: string) => void
}

export function GoogleSignInButton({
  clientId,
  text,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  // Google keeps the callback from the first initialize call, so route it
  // through refs to always reach the latest handlers.
  const handlers = useRef({ onCredential, onError })
  useEffect(() => {
    handlers.current = { onCredential, onError }
  })

  useEffect(() => {
    let cancelled = false
    loadGoogleIdentity()
      .then((google) => {
        const parent = container.current
        if (cancelled || !parent) return
        google.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          callback: (response) => handlers.current.onCredential(response.credential),
        })
        google.renderButton(parent, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text,
          shape: 'rectangular',
          width: Math.min(400, Math.max(200, Math.round(parent.clientWidth))),
        })
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError('Google sign-in is unavailable right now')
      })
    return () => {
      cancelled = true
    }
  }, [clientId, text])

  return (
    <div className="relative h-10 w-full">
      {!ready && (
        <div aria-hidden className="absolute inset-0 animate-pulse rounded-md bg-muted" />
      )}
      <div ref={container} className="flex h-10 w-full justify-center [color-scheme:normal]" />
    </div>
  )
}
