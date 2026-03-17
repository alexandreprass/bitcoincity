import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Road layout constants (must match City3D.tsx)
const ALL_ROAD_RADII = [8, 11, 15, 18, 22, 26, 30, 35, 40, 46, 52]
const ROAD_HALF_WIDTH = 1.2
const SPOKE_COUNT_VAL = 12
const SPOKE_HALF_WIDTH = 1.0

const isOnRoad = (r: number, a: number): boolean => {
  for (const rr of ALL_ROAD_RADII) {
    if (Math.abs(r - rr) < ROAD_HALF_WIDTH) return true
  }
  if (r > 3) {
    for (let s = 0; s < SPOKE_COUNT_VAL; s++) {
      const spokeAngle = (s / SPOKE_COUNT_VAL) * Math.PI * 2
      let angleDiff = Math.abs(a - spokeAngle) % (Math.PI * 2)
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff
      const arcDist = angleDiff * r
      if (arcDist < SPOKE_HALF_WIDTH) return true
    }
  }
  return false
}

// Mega building occupies center - skip radius < 3.5
const isOnMegaBuilding = (r: number): boolean => r < 3.5

function getValidSpiralPosition(idx: number): { x: number; z: number } {
  let spiralIdx = 0
  let validCount = 0
  let angle = 0
  let radius = 0

  while (validCount <= idx) {
    angle = spiralIdx * 0.8
    radius = 3.5 + spiralIdx * 0.6 // Start further out (mega building at center)
    const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    if (!isOnRoad(radius, normalizedAngle) && !isOnMegaBuilding(radius)) {
      validCount++
    }
    if (validCount <= idx) spiralIdx++
  }

  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
  }
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
      const pos = getValidSpiralPosition(idx)
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
