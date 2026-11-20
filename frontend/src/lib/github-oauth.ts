const STATE_KEY = 'github_oauth_state'
export const GITHUB_CALLBACK_PATH = '/auth/github/callback'

interface PendingSignIn {
  state: string
  redirectTo: string
}

export function githubRedirectUri(): string {
  return `${window.location.origin}${GITHUB_CALLBACK_PATH}`
}

/** Send the browser to GitHub; it comes back to the callback page. */
export function startGitHubSignIn(clientId: string, redirectTo: string): void {
  const state = crypto.randomUUID()
  const pending: PendingSignIn = { state, redirectTo }
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(pending))
  } catch {
    // Without storage the callback cannot check state and will refuse.
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: githubRedirectUri(),
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  })
  window.location.assign(`https://github.com/login/oauth/authorize?${params}`)
}

/**
 * Check the state GitHub sent back against the one saved before leaving.
 * Returns where to go after sign-in, or null if the state does not match.
 * The saved state is removed either way so it cannot be replayed.
 */
export function consumeGitHubState(state: string | null): string | null {
  let pending: PendingSignIn | null = null
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY)
    window.sessionStorage.removeItem(STATE_KEY)
    pending = raw ? (JSON.parse(raw) as PendingSignIn) : null
  } catch {
    pending = null
  }
  if (!pending || !state || pending.state !== state) return null
  return pending.redirectTo.startsWith('/') ? pending.redirectTo : '/'
}
