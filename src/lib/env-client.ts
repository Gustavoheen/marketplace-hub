/**
 * Public environment variables — safe to use in 'use client' components.
 * These are prefixed with NEXT_PUBLIC_ and are intentionally exposed to the browser.
 *
 * NEVER add secrets here. See src/lib/env.ts for server-side variables.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
}
