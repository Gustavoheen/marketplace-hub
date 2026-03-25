'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Plus, Building2 } from 'lucide-react'

type TenantOption = {
  id: string
  name: string
  slug: string
  plan: string
  role: string
}

export function TenantSwitcher({
  current,
  tenants,
}: {
  current: { id: string; name: string }
  tenants: TenantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const initials = current.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  async function switchTenant(tenantId: string) {
    if (tenantId === current.id || switching) return
    setSwitching(true)
    setOpen(false)
    try {
      await fetch('/api/tenant/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      router.refresh()
      router.push('/dashboard')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="relative mx-3 my-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-md px-3 py-2 transition-all"
        style={{
          background: open ? 'rgba(6,200,217,0.08)' : 'rgba(6,200,217,0.06)',
          border: `1px solid ${open ? 'rgba(6,200,217,0.2)' : 'rgba(6,200,217,0.12)'}`,
        }}
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold"
          style={{ background: 'rgba(6,200,217,0.15)', color: 'var(--cyan)', fontFamily: 'var(--font-syne)' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[11px] font-medium truncate" style={{ color: '#E8EDF5' }}>
            {current.name}
          </p>
          <p className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
            {tenants.length > 1 ? `${tenants.length} clientes` : 'Meu cliente'}
          </p>
        </div>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform"
          style={{
            color: 'var(--muted-foreground)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {open && (
        <>
          {/* Overlay para fechar */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg py-1 shadow-xl"
            style={{
              background: '#0D1117',
              border: '1px solid rgba(6,200,217,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {/* Cabeçalho */}
            <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}>
                Seus Clientes
              </p>
            </div>

            {/* Lista de tenants */}
            {tenants.map((t) => {
              const isCurrent = t.id === current.id
              const tInitials = t.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
              return (
                <button
                  key={t.id}
                  onClick={() => switchTenant(t.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all"
                  style={{
                    background: isCurrent ? 'rgba(6,200,217,0.08)' : 'transparent',
                    color: isCurrent ? 'var(--cyan)' : '#E8EDF5',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold"
                    style={{
                      background: isCurrent ? 'rgba(6,200,217,0.15)' : 'rgba(255,255,255,0.06)',
                      color: isCurrent ? 'var(--cyan)' : '#94A3B8',
                    }}
                  >
                    {tInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate">{t.name}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {t.role === 'admin' ? 'Admin' : t.role === 'analyst' ? 'Analista' : 'Visualizador'}
                    </p>
                  </div>
                  {isCurrent && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--cyan)' }} />}
                </button>
              )
            })}

            {/* Adicionar novo cliente */}
            <div style={{ borderTop: '1px solid var(--sidebar-border)', marginTop: '4px', paddingTop: '4px' }}>
              <a
                href="/configuracoes/clientes/novo"
                className="flex items-center gap-2.5 px-3 py-2 text-[12px] transition-all"
                style={{ color: 'var(--muted-foreground)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                  ;(e.currentTarget as HTMLElement).style.color = '#E8EDF5'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar cliente
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
