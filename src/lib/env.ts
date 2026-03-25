/**
 * Validated environment variables.
 *
 * SERVER-SIDE ONLY: import this only in server components, API routes, lib/,
 * middleware, and cron jobs. Never import in 'use client' files.
 *
 * Fails at module load time if any required variable is missing — catching
 * misconfigurations in deploy rather than at runtime.
 */

import { z } from 'zod'

// ── Schema ─────────────────────────────────────────────────────────────────

const serverSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Encryption (AES-256 — 64 hex chars = 32 bytes)
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    .regex(/^[0-9a-f]+$/i, 'ENCRYPTION_KEY must be a hex string'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),

  // AI
  GROQ_API_KEY: z.string().startsWith('gsk_', 'GROQ_API_KEY must start with gsk_'),

  // Cron security
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters').optional(),

  // OAuth — Bling (optional until user configures)
  BLING_CLIENT_ID: z.string().optional(),
  BLING_CLIENT_SECRET: z.string().optional(),

  // OAuth — Mercado Livre (optional until user configures)
  ML_CLIENT_ID: z.string().optional(),
  ML_CLIENT_SECRET: z.string().optional(),
})

// ── Public schema (safe to expose to browser) ─────────────────────────────

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

// ── Guard: prevent server secrets from leaking to the browser ─────────────

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[env] src/lib/env.ts was imported in a client component. ' +
        'Server secrets (SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY, GROQ_API_KEY, etc.) ' +
        'must NEVER reach the browser. Use src/lib/env-client.ts for public vars only.'
    )
  }
}

// ── Parse & export ─────────────────────────────────────────────────────────

function parseServerEnv() {
  assertServerOnly()

  const result = serverSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')

    throw new Error(
      `[env] Missing or invalid environment variables:\n${issues}\n\n` +
        'Copy .env.example to .env.local and fill in the required values.'
    )
  }

  return result.data
}

export const env = parseServerEnv()

// ── Type helpers ───────────────────────────────────────────────────────────

export type ServerEnv = z.infer<typeof serverSchema>
export type ClientEnv = z.infer<typeof clientSchema>
