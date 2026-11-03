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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { redirectTarget } from '@/lib/redirect'
import { ApiError, errorText } from '@/services/api'

const schema = z
  .object({
    displayName: z.string().trim().max(64, 'Keep it under 64 characters'),
    email: z.email('Enter a valid email address').trim(),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'Use at most 128 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type Values = z.infer<typeof schema>

export function SignUpPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    setServerError(null)
    try {
      await register({
        email: values.email,
        password: values.password,
        display_name: values.displayName || null,
      })
      toast.success('Account created')
      navigate(redirectTarget(location.state), { replace: true })
    } catch (error) {
      const message = errorText(error, 'Could not create your account')
      if (error instanceof ApiError && error.status === 409) {
        form.setError('email', { message }, { shouldFocus: true })
      } else {
        setServerError(message)
      }
      toast.error(message)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Save forecasts, follow your picks, and compare against the model's track record."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/sign-in"
            state={location.state}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <FormAlert message={serverError} />
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Display name{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input autoComplete="nickname" placeholder="Ada" className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
                  <PasswordInput autoComplete="new-password" className="h-10" {...field} />
                </FormControl>
                <FormDescription className="text-xs">At least 8 characters.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  )
}
