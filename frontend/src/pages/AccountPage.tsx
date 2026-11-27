import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormAlert } from '@/components/auth/FormAlert'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError, errorText } from '@/services/api'
import type { User } from '@/types'

const PROVIDER_LABELS: Record<User['providers'][number], string> = {
  google: 'Google',
  github: 'GitHub',
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function SubmitButton({
  busy,
  disabled = false,
  label,
  busyLabel,
}: {
  busy: boolean
  disabled?: boolean
  label: string
  busyLabel: string
}) {
  return (
    <Button type="submit" disabled={busy || disabled} className="h-10">
      {busy && <Loader2 aria-hidden className="animate-spin" />}
      {busy ? busyLabel : label}
    </Button>
  )
}

// --- Profile ------------------------------------------------------------------

const profileSchema = z.object({
  displayName: z.string().trim().max(64, 'Keep it under 64 characters'),
})

function ProfileForm({ user }: { user: User }) {
  const { updateProfile } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { displayName: user.display_name ?? '' },
    mode: 'onTouched',
  })
  const { isSubmitting, isDirty } = form.formState

  async function onSubmit({ displayName }: z.infer<typeof profileSchema>) {
    setServerError(null)
    try {
      await updateProfile(displayName || null)
      toast.success('Profile updated')
    } catch (error) {
      const message = errorText(error, 'Could not update your profile')
      setServerError(message)
      toast.error(message)
    }
  }

  return (
    <SettingsCard title="Profile" description="How your name appears in the app.">
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
          <SubmitButton busy={isSubmitting} disabled={!isDirty} label="Save name" busyLabel="Saving…" />
        </form>
      </Form>
    </SettingsCard>
  )
}

// --- Email --------------------------------------------------------------------

const emailSchema = z.object({
  newEmail: z.email('Enter a valid email address').trim(),
  currentPassword: z.string().min(1, 'Enter your current password'),
})

function EmailForm({ user }: { user: User }) {
  const { changeEmail } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: '', currentPassword: '' },
    mode: 'onTouched',
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: z.infer<typeof emailSchema>) {
    setServerError(null)
    try {
      const updated = await changeEmail(values.newEmail, values.currentPassword)
      form.reset()
      toast.success(`Email changed to ${updated.email}`)
    } catch (error) {
      const message = errorText(error, 'Could not change your email')
      if (error instanceof ApiError && error.status === 409) {
        form.setError('newEmail', { message }, { shouldFocus: true })
      } else if (message === 'Current password is incorrect') {
        form.setError('currentPassword', { message }, { shouldFocus: true })
      } else {
        setServerError(message)
      }
      toast.error(message)
    }
  }

  return (
    <SettingsCard
      title="Email"
      description={
        <>
          You sign in with <span className="font-medium text-foreground">{user.email}</span>.
        </>
      }
    >
      {!user.has_password ? (
        <p className="text-sm text-muted-foreground">
          Your account uses {user.providers.map((p) => PROVIDER_LABELS[p]).join(' and ')}{' '}
          sign-in. Set a password below before changing your email.
        </p>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
            <FormAlert message={serverError} />
            <FormField
              control={form.control}
              name="newEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New email</FormLabel>
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
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SubmitButton busy={isSubmitting} label="Change email" busyLabel="Saving…" />
          </form>
        </Form>
      )}
    </SettingsCard>
  )
}

// --- Password -----------------------------------------------------------------

const newPasswordFields = {
  newPassword: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(128, 'Use at most 128 characters'),
  confirmPassword: z.string().min(1, 'Confirm your new password'),
}

const matchPasswords = {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
}

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), ...newPasswordFields })
  .refine((v) => v.newPassword === v.confirmPassword, matchPasswords)

const setPasswordSchema = z
  .object({ currentPassword: z.string(), ...newPasswordFields })
  .refine((v) => v.newPassword === v.confirmPassword, matchPasswords)

type PasswordValues = z.infer<typeof changePasswordSchema>

function PasswordForm({ user }: { user: User }) {
  const { changePassword } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const hasPassword = user.has_password
  const form = useForm<PasswordValues>({
    resolver: zodResolver(hasPassword ? changePasswordSchema : setPasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: PasswordValues) {
    setServerError(null)
    try {
      await changePassword(values.newPassword, hasPassword ? values.currentPassword : null)
      form.reset()
      toast.success(hasPassword ? 'Password changed' : 'Password set')
    } catch (error) {
      const message = errorText(error, 'Could not update your password')
      if (message === 'Current password is incorrect') {
        form.setError('currentPassword', { message }, { shouldFocus: true })
      } else {
        setServerError(message)
      }
      toast.error(message)
    }
  }

  return (
    <SettingsCard
      title={hasPassword ? 'Password' : 'Set a password'}
      description={
        hasPassword
          ? 'Changing your password signs you out everywhere else.'
          : 'Add a password so you can also sign in with your email.'
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <FormAlert message={serverError} />
          {hasPassword && (
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
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
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SubmitButton
            busy={isSubmitting}
            label={hasPassword ? 'Change password' : 'Set password'}
            busyLabel="Saving…"
          />
        </form>
      </Form>
    </SettingsCard>
  )
}

// --- Delete -------------------------------------------------------------------

function DeleteAccountForm({ user }: { user: User }) {
  const { deleteAccount } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const hasPassword = user.has_password
  const schema = z.object({
    confirmEmail: z
      .string()
      .trim()
      .refine((value) => value.toLowerCase() === user.email, 'Type your email exactly'),
    currentPassword: hasPassword
      ? z.string().min(1, 'Enter your current password')
      : z.string(),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { confirmEmail: '', currentPassword: '' },
    mode: 'onTouched',
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    setServerError(null)
    try {
      await deleteAccount(values.confirmEmail, hasPassword ? values.currentPassword : null)
      toast.success('Your account was deleted')
    } catch (error) {
      const message = errorText(error, 'Could not delete your account')
      if (message === 'Current password is incorrect') {
        form.setError('currentPassword', { message }, { shouldFocus: true })
      } else {
        setServerError(message)
      }
      toast.error(message)
    }
  }

  return (
    <Card className="border-loss/40">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-loss">Delete account</CardTitle>
        <CardDescription>
          Permanently deletes your account, watchlist, and forecast history. This cannot be
          undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
            <FormAlert message={serverError} />
            <FormField
              control={form.control}
              name="confirmEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Type <span className="font-mono">{user.email}</span> to confirm
                  </FormLabel>
                  <FormControl>
                    <Input autoComplete="off" spellCheck={false} className="h-10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {hasPassword && (
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="current-password" className="h-10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" variant="destructive" disabled={isSubmitting} className="h-10">
              {isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
              {isSubmitting ? 'Deleting…' : 'Delete my account'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// --- Page ---------------------------------------------------------------------

function SignInMethods({ user }: { user: User }) {
  const methods = [
    ...(user.has_password ? ['Email and password'] : []),
    ...user.providers.map((p) => PROVIDER_LABELS[p]),
  ]
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      Signs in with
      {methods.map((method) => (
        <Badge key={method} variant="outline">
          {method}
        </Badge>
      ))}
    </span>
  )
}

export function AccountPage() {
  usePageTitle('Account settings')
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Account settings"
        description={<SignInMethods user={user} />}
      />
      <div className="grid max-w-2xl gap-6">
        <ProfileForm user={user} />
        <EmailForm user={user} />
        {/* Remount after a password is first set so the form switches mode. */}
        <PasswordForm key={String(user.has_password)} user={user} />
        <DeleteAccountForm key={`delete-${user.has_password}`} user={user} />
      </div>
    </div>
  )
}
