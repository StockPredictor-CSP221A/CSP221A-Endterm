import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { FormAlert } from '@/components/auth/FormAlert'
import { useAuth } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { consumeGitHubState, githubRedirectUri } from '@/lib/github-oauth'
import { errorText } from '@/services/api'

export function GitHubCallbackPage() {
  usePageTitle('Signing in')
  const { signInWithGitHub } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  // The code works once; guard against React running the effect twice.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const code = params.get('code')
    const redirectTo = consumeGitHubState(params.get('state'))

    if (params.get('error')) {
      setError('GitHub sign-in was cancelled.')
      return
    }
    if (!code || redirectTo === null) {
      setError('This sign-in link is invalid or has expired. Please try again.')
      return
    }

    signInWithGitHub(code, githubRedirectUri())
      .then((user) => {
        toast.success(`Welcome${user.display_name ? `, ${user.display_name}` : ''}`)
        navigate(redirectTo, { replace: true })
      })
      .catch((err: unknown) => setError(errorText(err, 'Could not sign in with GitHub')))
  }, [params, navigate, signInWithGitHub])

  return (
    <AuthLayout
      title="Signing in with GitHub"
      description="Hang tight while we finish signing you in."
      footer={
        <Link
          to="/sign-in"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      {error ? (
        <FormAlert message={error} />
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Finishing sign-in…
        </div>
      )}
    </AuthLayout>
  )
}
