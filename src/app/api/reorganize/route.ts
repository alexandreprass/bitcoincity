import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Ring-based placement constants (must match City3D.tsx and connect-wallet)
const ALL_ROAD_RADII = [8, 11, 15, 18, 22, 26, 30, 35, 40, 46, 52]
const SPOKE_COUNT_VAL = 12
const SPOKE_HALF_WIDTH = 1.0
const BUILDING_W = 1.4 // must match City3D.tsx BUILDING_WIDTH
const GAP = 0.66 // ~3 windows gap between buildings

// Pre-calculate all valid building positions (rings between roads)
const BUILDING_RINGS: number[] = []
BUILDING_RINGS.push((3.5 + ALL_ROAD_RADII[0]) / 2) // between mega building and first road
for (let i = 0; i < ALL_ROAD_RADII.length - 1; i++) {
  BUILDING_RINGS.push((ALL_ROAD_RADII[i] + ALL_ROAD_RADII[i + 1]) / 2)
}
BUILDING_RINGS.push(ALL_ROAD_RADII[ALL_ROAD_RADII.length - 1] + 3) // after last road

const ALL_POSITIONS: { x: number; z: number }[] = []
for (const ringR of BUILDING_RINGS) {
  const circumference = 2 * Math.PI * ringR
  const slotSize = BUILDING_W + GAP
  const numSlots = Math.floor(circumference / slotSize)

  for (let s = 0; s < numSlots; s++) {
    const angle = (s / numSlots) * Math.PI * 2
    // Skip positions that overlap with spokes
    let onSpoke = false
    for (let sp = 0; sp < SPOKE_COUNT_VAL; sp++) {
      const spokeAngle = (sp / SPOKE_COUNT_VAL) * Math.PI * 2
      let angleDiff = Math.abs(angle - spokeAngle) % (Math.PI * 2)
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff
      const arcDist = angleDiff * ringR
      if (arcDist < SPOKE_HALF_WIDTH + 0.3) { onSpoke = true; break }
    }
    if (!onSpoke) {
      ALL_POSITIONS.push({
        x: Math.cos(angle) * ringR,
        z: Math.sin(angle) * ringR,
      })
    }
  }
}

function getValidRingPosition(idx: number): { x: number; z: number } {
  return ALL_POSITIONS[idx % ALL_POSITIONS.length]
}

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supabase = createServerSupabase(url, serviceKey)

  try {
    // Fetch all buildings sorted by balance (biggest first = closest to center)
    const { data: buildings, error } = await supabase
      .from('buildings')
      .select('id, balance_satoshis')
      .order('balance_satoshis', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!buildings || buildings.length === 0) {
      return NextResponse.json({ success: true, reorganized: 0 })
    }

    // Reassign positions: biggest buildings closest to center
    const updates = buildings.map((b, idx) => {
      const pos = getValidRingPosition(idx)
      return supabase
        .from('buildings')
        .update({ position_x: pos.x, position_z: pos.z })
        .eq('id', b.id)
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true, reorganized: buildings.length })
  } catch (err: any) {
    console.error('Reorganize error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
