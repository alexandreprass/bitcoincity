import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for server-side use with fetch caching disabled.
 * Next.js App Router caches fetch() by default, which causes stale data.
 * This ensures every Supabase query hits the database directly.
 */
export function createServerSupabase(url: string, key: string) {
  return createClient(url, key, {
    global: {
      fetch: (input, init) => {
        return fetch(input, { ...init, cache: 'no-store' })
      },
    },
  })
}
