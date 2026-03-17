import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Ring-based placement constants (must match City3D.tsx)
const ALL_ROAD_RADII = [8, 16, 24, 32, 40, 50, 62, 75]
const BUILDING_W = 1.4 // must match City3D.tsx BUILDING_WIDTH
const GAP = 0.66 // ~3 windows gap between buildings
const ROAD_HW = 0.6 // road half-width

// Pre-calculate all valid building positions (2 rings between each pair of roads)
const BUILDING_RINGS: number[] = []
BUILDING_RINGS.push((3.5 + ALL_ROAD_RADII[0] - ROAD_HW) / 2) // between mega building and first road
for (let i = 0; i < ALL_ROAD_RADII.length - 1; i++) {
  const innerEdge = ALL_ROAD_RADII[i] + ROAD_HW
  const outerEdge = ALL_ROAD_RADII[i + 1] - ROAD_HW
  BUILDING_RINGS.push(innerEdge + (outerEdge - innerEdge) * 0.33)
  BUILDING_RINGS.push(innerEdge + (outerEdge - innerEdge) * 0.67)
}
BUILDING_RINGS.push(ALL_ROAD_RADII[ALL_ROAD_RADII.length - 1] + 3) // after last road

const ALL_POSITIONS: { x: number; z: number }[] = []
for (const ringR of BUILDING_RINGS) {
  const circumference = 2 * Math.PI * ringR
  const slotSize = BUILDING_W + GAP
  const numSlots = Math.floor(circumference / slotSize)

  for (let s = 0; s < numSlots; s++) {
    const angle = (s / numSlots) * Math.PI * 2
    ALL_POSITIONS.push({
      x: Math.cos(angle) * ringR,
      z: Math.sin(angle) * ringR,
    })
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
    // Fetch all buildings
    const { data: buildings, error } = await supabase
      .from('buildings')
      .select('*')
      .order('balance_satoshis', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!buildings || buildings.length === 0) {
      return NextResponse.json({ success: true, reorganized: 0 })
    }

    // Sort: admin first, then by balance (biggest closest to center)
    buildings.sort((a: any, b: any) => {
      if (a.is_admin && !b.is_admin) return -1
      if (!a.is_admin && b.is_admin) return 1
      return (b.balance_satoshis || 0) - (a.balance_satoshis || 0)
    })

    // Reassign positions: admin/biggest buildings closest to center
    const updates = buildings.map((b: any, idx: number) => {
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
