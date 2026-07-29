// ─── Supabase Browser Client ──────────────────────────────────────────────────
// Used in 'use client' components (login form, interactive tables, etc.)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
