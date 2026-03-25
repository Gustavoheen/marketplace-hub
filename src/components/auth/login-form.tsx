'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-3 text-[13px]"
          style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--rose)' }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[12px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
          autoFocus
          className="w-full rounded-lg px-4 py-2.5 text-[13px] outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--sidebar-border)',
            color: '#E8EDF5',
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = 'rgba(6,200,217,0.5)'
            ;(e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(6,200,217,0.06)'
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = 'var(--sidebar-border)'
            ;(e.target as HTMLInputElement).style.boxShadow = 'none'
          }}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[12px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Senha
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full rounded-lg px-4 py-2.5 text-[13px] outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--sidebar-border)',
            color: '#E8EDF5',
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = 'rgba(6,200,217,0.5)'
            ;(e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(6,200,217,0.06)'
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = 'var(--sidebar-border)'
            ;(e.target as HTMLInputElement).style.boxShadow = 'none'
          }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold transition-all disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, #06C8D9 0%, #0891B2 100%)',
          color: '#07090F',
          boxShadow: loading ? 'none' : '0 0 20px rgba(6,200,217,0.25)',
        }}
        onMouseEnter={(e) => {
          if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(6,200,217,0.4)'
        }}
        onMouseLeave={(e) => {
          if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(6,200,217,0.25)'
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Entrar
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-center text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
        Não tem conta?{' '}
        <Link
          href="/registro"
          className="font-medium transition-colors hover:underline underline-offset-4"
          style={{ color: 'var(--cyan)' }}
        >
          Criar conta
        </Link>
      </p>
    </form>
  )
}
