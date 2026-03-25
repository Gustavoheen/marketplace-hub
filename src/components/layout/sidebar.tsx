'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, ShoppingCart, Link2,
  Tag, Truck, Bot, Share2, Settings, LogOut,
  TrendingUp, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/hooks/use-tenant'

const navGroups = [
  {
    label: 'Visão Geral',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operações',
    items: [
      { href: '/produtos', label: 'Produtos', icon: Package },
      { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
      { href: '/logistica', label: 'Logística', icon: Truck },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { href: '/precificacao', label: 'Precificação', icon: Tag },
      { href: '/agentes', label: 'Agentes IA', icon: Bot, badge: 'NOVO' },
    ],
  },
  {
    label: 'Configurar',
    items: [
      { href: '/conexoes', label: 'Conexões', icon: Link2 },
      { href: '/compartilhar', label: 'Compartilhar', icon: Share2 },
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, user } = useTenant()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = tenant.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <aside
      className="flex h-screen w-[220px] shrink-0 flex-col"
      style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0"
          style={{
            background: 'linear-gradient(135deg, #06C8D9 0%, #0891B2 100%)',
            color: '#07090F',
            fontFamily: 'var(--font-syne)',
            boxShadow: '0 0 12px rgba(6,200,217,0.3)',
          }}
        >
          MH
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate text-foreground" style={{ fontFamily: 'var(--font-syne)' }}>
            Marketplace Hub
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="live-dot h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--emerald)' }} />
            <span className="text-[10px] truncate" style={{ color: 'var(--emerald)' }}>ao vivo</span>
          </div>
        </div>
      </div>

      {/* Tenant badge */}
      <div className="mx-3 my-2 rounded-md px-3 py-2" style={{ background: 'rgba(6,200,217,0.06)', border: '1px solid rgba(6,200,217,0.12)' }}>
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold"
            style={{ background: 'rgba(6,200,217,0.15)', color: 'var(--cyan)', fontFamily: 'var(--font-syne)' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium truncate" style={{ color: '#E8EDF5' }}>
              {tenant.name}
            </p>
            <p className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
              {user.role}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p
              className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}
            >
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, badge }: any) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'nav-active-line flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] font-medium transition-all duration-150',
                      active ? 'active text-cyan-400' : 'hover:text-foreground'
                    )}
                    style={{
                      color: active ? 'var(--cyan)' : 'var(--sidebar-foreground)',
                      background: active ? 'rgba(6,200,217,0.08)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    <Icon
                      className="h-[15px] w-[15px] shrink-0"
                      style={{ color: active ? 'var(--cyan)' : 'inherit' }}
                    />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span
                        className="rounded px-1 py-0.5 text-[8px] font-bold tracking-wide"
                        style={{ background: 'rgba(16,212,138,0.15)', color: 'var(--emerald)' }}
                      >
                        {badge}
                      </span>
                    )}
                    {active && (
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="mb-1 px-3 py-2 rounded-md" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-[11px] truncate font-medium" style={{ color: '#94A3B8' }}>
            {user.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-all"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.08)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--rose)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
          }}
        >
          <LogOut className="h-[15px] w-[15px] shrink-0" />
          Sair da conta
        </button>
      </div>
    </aside>
  )
}
