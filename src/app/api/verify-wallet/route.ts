import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { VERIFICATION_WALLET } from '@/lib/bitcoin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supabase = createServerSupabase(url, serviceKey)

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { userId, btcAddress } = body
  if (!userId || !btcAddress) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://blockchain.info/rawaddr/${btcAddress}?limit=20`,
      { cache: 'no-store', headers: { 'User-Agent': 'BitcoinCity/1.0' } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to check blockchain' }, { status: 502 })
    }

    const data = await res.json()
    const txs = data.txs || []

    let found = false
    for (const tx of txs) {
      for (const out of tx.out || []) {
        if (out.addr === VERIFICATION_WALLET && out.value > 0) {
          found = true
          break
        }
      }
      if (found) break
    }

    if (found) {
      await supabase
        .from('buildings')
        .update({ verified: true })
        .eq('user_id', userId)

      return NextResponse.json({ verified: true })
    }

    return NextResponse.json({ verified: false })
  } catch (err: any) {
    console.error('Verify error:', err)
    return NextResponse.json({ error: 'Failed to verify' }, { status: 500 })
  }
}
