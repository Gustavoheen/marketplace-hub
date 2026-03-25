import { createClient } from '@supabase/supabase-js'

/**
 * Cliente com service role — usar apenas em API routes do servidor.
 * NUNCA expor no browser.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
