import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Entrar — Marketplace Hub',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Marketplace Hub</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Entre na sua conta para continuar
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
