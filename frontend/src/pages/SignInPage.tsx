import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { FormAlert } from '@/components/auth/FormAlert'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { redirectTarget } from '@/lib/redirect'
import { errorText } from '@/services/api'
import { usePageTitle } from '@/hooks/usePageTitle'

const schema = z.object({
  email: z.email('Enter a valid email address').trim(),
  password: z.string().min(1, 'Enter your password'),
})

type Values = z.infer<typeof schema>

export function SignInPage() {
  usePageTitle('Sign in')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    setServerError(null)
    try {
      const user = await login(values)
      toast.success(`Welcome back${user.display_name ? `, ${user.display_name}` : ''}`)
      navigate(redirectTarget(location.state), { replace: true })
    } catch (error) {
      const message = errorText(error, 'Could not sign in')
      setServerError(message)
      toast.error(message)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Pick up where you left off with your forecasts and watchlist."
      footer={
        <>
          New here?{' '}
          <Link
            to="/sign-up"
            state={location.state}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <FormAlert message={serverError} />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="Your password"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  )
}
