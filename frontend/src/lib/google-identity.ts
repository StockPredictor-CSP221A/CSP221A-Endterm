interface GoogleCredentialResponse {
  credential: string
}

interface GoogleIdApi {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with'
      shape?: 'rectangular' | 'pill'
      width?: number
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleIdApi> | null = null

/** Load Google's sign-in script once and resolve with its API. */
export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (loading) return loading

  loading = new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => {
      const api = window.google?.accounts?.id
      if (api) resolve(api)
      else reject(new Error('Google sign-in did not load'))
    }
    script.onerror = () => reject(new Error('Google sign-in did not load'))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}
