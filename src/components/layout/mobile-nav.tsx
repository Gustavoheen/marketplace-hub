'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Tag, Bot, MoreHorizontal,
  Package, Link2, Truck, Share2, Settings, LogOut, X,
  TrendingUp, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/hooks/use-tenant'
import { TenantSwitcher } from './tenant-switcher'

// Bottom nav items (5 max)
const TAB_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/precificacao', label: 'Preços', icon: Tag },
  { href: '/agentes', label: 'Agentes', icon: Bot },
]

// Drawer items (remaining nav)
const DRAWER_GROUPS = [
  {
    label: 'Operações',
    items: [
      { href: '/produtos', label: 'Produtos', icon: Package },
      { href: '/logistica', label: 'Logística', icon: Truck },
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

export function MobileNav({
  allTenants = [],
}: {
  allTenants?: Array<{ id: string; name: string; slug: string; plan: string; role: string }>
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, user } = useTenant()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isTabActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const isDrawerActive = DRAWER_GROUPS.flatMap(g => g.items).some(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: 'rgba(7,9,15,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--sidebar-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center justify-around px-2 py-1">
          {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isTabActive(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all"
                style={{ minWidth: 56 }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
                  style={{
                    background: active ? 'rgba(6,200,217,0.15)' : 'transparent',
                    boxShadow: active ? '0 0 12px rgba(6,200,217,0.2)' : 'none',
                  }}
                >
                  <Icon
                    className="h-[18px] w-[18px]"
                    style={{ color: active ? 'var(--cyan)' : 'var(--muted-foreground)' }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: active ? 'var(--cyan)' : 'var(--muted-foreground)' }}
                >
                  {label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl"
            style={{ minWidth: 56 }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{
                background: (drawerOpen || isDrawerActive) ? 'rgba(129,140,248,0.15)' : 'transparent',
              }}
            >
              <MoreHorizontal
                className="h-[18px] w-[18px]"
                style={{ color: (drawerOpen || isDrawerActive) ? '#818CF8' : 'var(--muted-foreground)' }}
              />
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: (drawerOpen || isDrawerActive) ? '#818CF8' : 'var(--muted-foreground)' }}
            >
              Mais
            </span>
          </button>
        </div>
      </nav>

      {/* Drawer Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl"
        style={{
          background: 'var(--sidebar)',
          border: '1px solid var(--sidebar-border)',
          transform: drawerOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ background: 'var(--sidebar-border)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg, #06C8D9 0%, #0891B2 100%)',
                color: '#07090F',
                fontFamily: 'var(--font-syne)',
                boxShadow: '0 0 10px rgba(6,200,217,0.3)',
              }}
            >
              MH
            </div>
            <p className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}>
              Menu
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Tenant switcher */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <TenantSwitcher
            current={{ id: (tenant as any).id || '', name: tenant.name }}
            tenants={
              allTenants.length > 0
                ? allTenants
                : [{ id: (tenant as any).id || '', name: tenant.name, slug: (tenant as any).slug || '', plan: (tenant as any).plan || 'free', role: user.role }]
            }
          />
        </div>

        {/* Nav groups */}
        <div className="px-3 py-2 space-y-4">
          {DRAWER_GROUPS.map(group => (
            <div key={group.label}>
              <p
                className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-syne)' }}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 rounded-xl px-3 py-3"
                      style={{
                        background: active ? 'rgba(6,200,217,0.08)' : 'rgba(255,255,255,0.02)',
                        color: active ? 'var(--cyan)' : '#94A3B8',
                      }}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-[14px] font-medium">{label}</span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User + logout */}
        <div className="px-3 pb-4 pt-2 space-y-1" style={{ borderTop: '1px solid var(--sidebar-border)', marginTop: 8 }}>
          <div
            className="rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <p className="text-[12px] font-medium" style={{ color: '#94A3B8' }}>{user.email}</p>
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{tenant.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3"
            style={{ background: 'rgba(244,63,94,0.06)', color: '#F87171' }}
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[14px] font-medium">Sair da conta</span>
          </button>
        </div>
      </div>
    </>
  )
}
