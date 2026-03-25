'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import Link from 'next/link'

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, tenant_name: tenantName },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user && !data.user.email_confirmed_at) {
      setSuccess(true)
      setLoading(false)
      return
    }

    // Se confirmacao de email desabilitada (dev), redireciona direto
    router.push('/dashboard')
    router.refresh()
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-2">
          <p className="font-medium">Verifique seu email</p>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmacao para <strong>{email}</strong>.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="pt-6 space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant">Nome da empresa / conta</Label>
            <Input
              id="tenant"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Ex: Minha Loja"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 8 caracteres"
              minLength={8}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Ja tem conta?{' '}
            <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
