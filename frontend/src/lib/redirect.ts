import type { Location } from 'react-router-dom'

interface RedirectState {
  from?: Location
}

/** Where to send a user after signing in, based on the guarded route they hit. */
export function redirectTarget(state: unknown): string {
  const from = (state as RedirectState | null)?.from
  if (!from || from.pathname.startsWith('/sign-')) return '/'
  return `${from.pathname}${from.search}${from.hash}`
}
