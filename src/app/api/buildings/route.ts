import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const key = serviceKey || anonKey
  if (!url || !key || url === 'https://placeholder.supabase.co') {
    return NextResponse.json({ buildings: [] })
  }

  const supabase = createClient(url, key)

  const { data: buildings, error } = await supabase
    .from('buildings')
    .select('id, user_id, username, display_name, btc_address, balance_satoshis, height, position_x, position_z, color, verified, message, verification_deadline, created_at')
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
