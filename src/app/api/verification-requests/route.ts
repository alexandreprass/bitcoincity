import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function checkAdmin(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const password = authHeader.replace('Bearer ', '')
  return password === process.env.ADMIN_PASSWORD
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServerSupabase(url, serviceKey)
}

// GET - list pending verification requests (admin only)
export async function GET(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch display names for each request
  const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id)))
  const { data: buildings } = await supabase
    .from('buildings')
    .select('user_id, display_name, username')
    .in('user_id', userIds)

  const nameMap: Record<string, string> = {}
  for (const b of buildings || []) {
    nameMap[b.user_id] = b.display_name || b.username || 'Unknown'
  }

  const enriched = (data || []).map((r: any) => ({
    ...r,
    display_name: nameMap[r.user_id] || 'Unknown',
  }))

  return NextResponse.json({ requests: enriched })
}

// POST - create a verification request (authenticated user)
export async function POST(request: Request) {
  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { userId, btcAddress, txHash } = body

  if (!userId || !btcAddress || !txHash) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check if user already has a pending request
  const { data: existing } = await supabase
    .from('verification_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending verification request' }, { status: 409 })
  }

  const { error } = await supabase
    .from('verification_requests')
    .insert({
      user_id: userId,
      btc_address: btcAddress,
      tx_hash: txHash,
      status: 'pending',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE - admin: delete a request
export async function DELETE(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('id')

  if (!requestId) {
    return NextResponse.json({ error: 'Missing request id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('verification_requests')
    .delete()
    .eq('id', requestId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// PUT - admin: approve a verification request
export async function PUT(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { requestId } = body

  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
  }

  // Get the request
  const { data: req } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // Mark request as approved
  await supabase
    .from('verification_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)

  // Mark building as verified
  await supabase
    .from('buildings')
    .update({ verified: true })
    .eq('user_id', req.user_id)

  return NextResponse.json({ success: true })
}
