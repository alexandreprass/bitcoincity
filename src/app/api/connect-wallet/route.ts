import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidBtcAddress, getBuildingHeight, satoshisToBtc } from '@/lib/bitcoin'

const BUILDING_COLORS = [
  '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C',
  '#3498DB', '#9B59B6', '#E91E63', '#00BCD4', '#FF5722',
  '#795548', '#607D8B', '#8BC34A', '#FF9800', '#673AB7',
  '#009688', '#F44336', '#4CAF50', '#2196F3', '#FFC107',
]

function getRandomBuildingColor(): string {
  return BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)]
}

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
    // Check wallet change limit
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_changes')
      .eq('id', userId)
      .single()

    const changes = profile?.wallet_changes || 0
    if (changes >= 3) {
      return NextResponse.json({ error: 'You have reached the maximum number of wallet changes (3).' }, { status: 403 })
    }

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

    // Set verification deadline for 1+ BTC holders (7 days from now)
    const btcAmount = satoshisToBtc(satoshis)
    const verificationDeadline = btcAmount >= 1
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null

    const randomColor = getRandomBuildingColor()

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
        color: randomColor,
        verification_deadline: verificationDeadline,
      })

    if (buildingError) {
      console.error('Building insert error:', buildingError)
      return NextResponse.json({ error: 'Failed to save building: ' + buildingError.message }, { status: 500 })
    }

    // Increment wallet changes counter
    await supabase
      .from('profiles')
      .update({ wallet_changes: (changes || 0) + 1 })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      balance: satoshis,
      height: getBuildingHeight(satoshis),
      color: randomColor,
    })
  } catch (err: any) {
    console.error('Connect wallet error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
