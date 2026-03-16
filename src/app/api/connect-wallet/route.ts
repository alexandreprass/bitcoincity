import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidBtcAddress, getBuildingHeight, getBuildingColor } from '@/lib/bitcoin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  // Service role client bypasses RLS
  const supabase = createClient(url, serviceKey)

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { userId, btcAddress, username, displayName } = body

  if (!userId || !btcAddress) {
    return NextResponse.json({ error: 'Missing userId or btcAddress' }, { status: 400 })
  }

  if (!isValidBtcAddress(btcAddress)) {
    return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 })
  }

  try {
    // Check if wallet is claimed by someone else
    const { data: existing } = await supabase
      .from('wallets')
      .select('user_id')
      .eq('btc_address', btcAddress)
      .neq('user_id', userId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'WALLET_CLAIMED', message: 'This wallet is already claimed by another user.' }, { status: 409 })
    }

    // Fetch balance
    const balanceRes = await fetch(
      `https://blockchain.info/q/addressbalance/${btcAddress}?confirmations=1`,
      { headers: { 'User-Agent': 'BitcoinCity/1.0' } }
    )

    if (!balanceRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch balance from blockchain' }, { status: 502 })
    }

    const balanceText = await balanceRes.text()
    const satoshis = parseInt(balanceText, 10)

    if (isNaN(satoshis)) {
      return NextResponse.json({ error: 'Invalid balance response' }, { status: 502 })
    }

    // Delete existing records for this user
    await supabase.from('buildings').delete().eq('user_id', userId)
    await supabase.from('wallets').delete().eq('user_id', userId)

    // Insert wallet
    const { error: walletError } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        btc_address: btcAddress,
        balance_satoshis: satoshis,
        last_updated: new Date().toISOString(),
      })

    if (walletError) {
      console.error('Wallet insert error:', walletError)
      return NextResponse.json({ error: 'Failed to save wallet: ' + walletError.message }, { status: 500 })
    }

    // Calculate position
    const { count } = await supabase
      .from('buildings')
      .select('*', { count: 'exact', head: true })

    const idx = count || 0
    const angle = idx * 0.8
    const radius = 3 + idx * 0.6

    // Insert building
    const { error: buildingError } = await supabase
      .from('buildings')
      .insert({
        user_id: userId,
        username: username || 'Anon',
        display_name: displayName || username || 'Anon',
        btc_address: btcAddress,
        balance_satoshis: satoshis,
        height: getBuildingHeight(satoshis),
        position_x: Math.cos(angle) * radius,
        position_z: Math.sin(angle) * radius,
        color: getBuildingColor(satoshis),
      })

    if (buildingError) {
      console.error('Building insert error:', buildingError)
      return NextResponse.json({ error: 'Failed to save building: ' + buildingError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      balance: satoshis,
      height: getBuildingHeight(satoshis),
      color: getBuildingColor(satoshis),
    })
  } catch (err: any) {
    console.error('Connect wallet error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
