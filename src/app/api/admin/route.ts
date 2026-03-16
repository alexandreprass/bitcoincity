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

// GET - list all citizens
export async function GET(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supabase = createServerSupabase(url, serviceKey)

  const { data: buildings, error } = await supabase
    .from('buildings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ buildings: buildings || [] })
}

// POST - toggle verified status
export async function POST(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const { userId, verified } = body

  const { error } = await supabase
    .from('buildings')
    .update({ verified: !!verified })
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE - delete all data for a user
export async function DELETE(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supabase = createServerSupabase(url, serviceKey)

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  // Delete in order: verification_requests, buildings, wallets, profiles
  await supabase.from('verification_requests').delete().eq('user_id', userId)
  await supabase.from('buildings').delete().eq('user_id', userId)
  await supabase.from('wallets').delete().eq('user_id', userId)
  await supabase.from('profiles').delete().eq('id', userId)

  // Delete from Supabase Auth so the user can't log in anymore
  const { error: authError } = await supabase.auth.admin.deleteUser(userId)
  if (authError) {
    console.error('Failed to delete user from auth:', authError.message)
    return NextResponse.json({ error: `Data deleted but auth deletion failed: ${authError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
