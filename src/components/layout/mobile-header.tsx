'use client'

import { Bell } from 'lucide-react'
import { useTenant } from '@/hooks/use-tenant'

interface MobileHeaderProps {
  title: string
}

export function MobileHeader({ title }: MobileHeaderProps) {
  const { tenant } = useTenant()

  return (
    <div
      className="flex h-14 shrink-0 items-center justify-between px-4 md:hidden"
      style={{
        background: 'rgba(7,9,15,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--sidebar-border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Logo + title */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold shrink-0"
          style={{
            background: 'linear-gradient(135deg, #06C8D9 0%, #0891B2 100%)',
            color: '#07090F',
            fontFamily: 'var(--font-syne)',
            boxShadow: '0 0 10px rgba(6,200,217,0.3)',
          }}
        >
          MH
        </div>
        <div className="min-w-0">
          <p
            className="text-[14px] font-semibold truncate"
            style={{ fontFamily: 'var(--font-syne)', color: '#E8EDF5' }}
          >
            {title}
          </p>
          <p className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
            {tenant.name}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <Bell className="h-[18px] w-[18px]" style={{ color: 'var(--muted-foreground)' }} />
          <span
            className="absolute right-2 top-2 h-2 w-2 rounded-full"
            style={{ background: 'var(--cyan)', boxShadow: '0 0 6px rgba(6,200,217,0.8)' }}
          />
        </button>
      </div>
    </div>
  )
}
