import { RegisterForm } from '@/components/auth/register-form'

export const metadata = {
  title: 'Criar conta — Marketplace Hub',
}

export default function RegistroPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Marketplace Hub</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Crie sua conta de analista
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}
