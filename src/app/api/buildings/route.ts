import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const key = serviceKey || anonKey
  if (!url || !key || url === 'https://placeholder.supabase.co') {
    return NextResponse.json({ buildings: [] })
  }

  const supabase = createServerSupabase(url, key)

  const { data: buildings, error } = await supabase
    .from('buildings')
    .select('*')
    .order('balance_satoshis', { ascending: false })

  if (error) {
    console.error('Buildings fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter out buildings where verification_deadline has passed and not verified
  const now = new Date()
  const filtered = (buildings || []).filter((b: any) => {
    if (b.verification_deadline && !b.verified) {
      const deadline = new Date(b.verification_deadline)
      if (deadline < now) return false
    }
    return true
  })

  // Sort admin building first (if is_admin column exists)
  filtered.sort((a: any, b: any) => {
    if (a.is_admin && !b.is_admin) return -1
    if (!a.is_admin && b.is_admin) return 1
    return (b.balance_satoshis || 0) - (a.balance_satoshis || 0)
  })

  return NextResponse.json(
    { buildings: filtered },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    }
  )
}
