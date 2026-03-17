import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
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
      { cache: 'no-store', headers: { 'User-Agent': 'BitcoinCity/1.0' } }
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

    // Calculate position (avoiding roads)
    const { count } = await supabase
      .from('buildings')
      .select('*', { count: 'exact', head: true })

    // Road ring radii and spoke config
    const ROAD_RADII = [8, 15, 22, 30, 40, 52]
    const ROAD_HALF_WIDTH = 1.2 // avoid ±1.2 around each ring road
    const SPOKE_COUNT = 12
    const SPOKE_HALF_WIDTH = 1.0 // avoid ±1.0 around each spoke

    const isOnRoad = (r: number, a: number): boolean => {
      // Check ring roads
      for (const rr of ROAD_RADII) {
        if (Math.abs(r - rr) < ROAD_HALF_WIDTH) return true
      }
      // Check radial spokes (only for r > 3)
      if (r > 3) {
        for (let s = 0; s < SPOKE_COUNT; s++) {
          const spokeAngle = (s / SPOKE_COUNT) * Math.PI * 2
          // Distance from point to spoke line at this angle
          let angleDiff = Math.abs(a - spokeAngle) % (Math.PI * 2)
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff
          // Arc distance = angleDiff * radius
          const arcDist = angleDiff * r
          if (arcDist < SPOKE_HALF_WIDTH) return true
        }
      }
      return false
    }

    // Spiral placement that skips road positions
    let idx = count || 0
    let spiralIdx = 0
    let angle = 0
    let radius = 0
    // Walk the spiral until we find `idx+1` valid positions
    let validCount = 0
    while (validCount <= idx) {
      angle = spiralIdx * 0.8
      radius = 3 + spiralIdx * 0.6
      if (!isOnRoad(radius, angle % (Math.PI * 2))) {
        validCount++
      }
      if (validCount <= idx) spiralIdx++
    }

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
