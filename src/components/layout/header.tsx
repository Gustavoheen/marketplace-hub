'use client'

import { useTenant } from '@/hooks/use-tenant'
import { Bell, Search } from 'lucide-react'

interface HeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function Header({ title, description, action }: HeaderProps) {
  const { tenant } = useTenant()

  return (
    <div
      className="flex h-14 shrink-0 items-center justify-between px-6 gap-4"
      style={{ borderBottom: '1px solid var(--sidebar-border)', background: 'var(--background)' }}
    >
      {/* Title */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1
            className="text-[15px] font-semibold truncate"
            style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}
          >
            {title}
          </h1>
          {description && (
            <>
              <span style={{ color: 'var(--sidebar-border)' }}>/</span>
              <span className="text-[13px] truncate hidden sm:block" style={{ color: 'var(--muted-foreground)' }}>
                {description}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {action && <div>{action}</div>}

        {/* Search trigger */}
        <button
          className="hidden sm:flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--sidebar-border)',
            color: 'var(--muted-foreground)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(6,200,217,0.3)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--foreground)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
          }}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Buscar...</span>
          <span
            className="ml-2 rounded px-1 text-[10px]"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted-foreground)' }}
          >
            ⌘K
          </span>
        </button>

        {/* Notifications */}
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md transition-all"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--foreground)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
          }}
        >
          <Bell className="h-4 w-4" />
          {/* Notification dot */}
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--cyan)', boxShadow: '0 0 6px rgba(6,200,217,0.8)' }}
          />
        </button>
      </div>
    </div>
  )
}
