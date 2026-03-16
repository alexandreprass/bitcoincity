import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === 'https://placeholder.supabase.co') {
    return NextResponse.json({ buildings: [] })
  }

  const supabase = createClient(url, key)

  const { data: buildings, error } = await supabase
    .from('buildings')
    .select('*')
    .order('balance_satoshis', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ buildings: buildings || [] })
}
