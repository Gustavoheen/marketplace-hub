import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { MARKETPLACE_LABELS } from '@/types'
import type { Marketplace } from '@/types'
import { Plug } from 'lucide-react'

const marketplaces: Marketplace[] = [
  'bling',
  'mercadolivre',
  'shopee',
  'amazon',
  'magalu',
  'shein',
  'casas_bahia',
  'webcontinental',
  'madeiramadeira',
]

export const metadata = {
  title: 'Conexões — Marketplace Hub',
}

export default function ConexoesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Conexões"
        description="Gerencie as integrações com ERPs e marketplaces"
      />
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketplaces.map((mp) => (
            <div
              key={mp}
              className="rounded-lg border bg-card p-5 flex items-start justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md border bg-muted flex items-center justify-center">
                  <Plug className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{MARKETPLACE_LABELS[mp]}</p>
                  <p className="text-xs text-muted-foreground">Não conectado</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                Em breve
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
