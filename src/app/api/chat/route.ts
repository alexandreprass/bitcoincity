import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServerSupabase(url, serviceKey)
}

// GET - fetch recent chat messages (last 24h only)
export async function GET(request: Request) {
  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  // Auto-cleanup: delete messages older than 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('chat_messages')
    .delete()
    .lt('created_at', cutoff)

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { messages: (data || []).reverse() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST - send a new chat message
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

  const { userId, username, message } = body

  if (!userId || !username || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Basic rate limiting: check last message time
  const { data: recent } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (recent) {
    const lastTime = new Date(recent.created_at).getTime()
    const now = Date.now()
    if (now - lastTime < 2000) {
      return NextResponse.json({ error: 'Too fast! Wait a moment.' }, { status: 429 })
    }
  }

  const trimmed = message.trim().slice(0, 500)

  // Block links (http, https, www, .com, .io, .xyz, .org, .net, etc.)
  const linkPatterns = [
    /https?:\/\//i,
    /www\./i,
    /\.[a-z]{2,6}\//i,
    /\.(com|io|xyz|org|net|app|dev|co|me|gg|fun|ai|cc|tv|ly|to|link|site|online|click)\b/i,
  ]
  for (const pattern of linkPatterns) {
    if (pattern.test(trimmed)) {
      return NextResponse.json({ error: 'Links are not allowed in chat.' }, { status: 400 })
    }
  }

  // Block Solana contract addresses (base58, 32-44 chars of alphanumeric)
  // Solana addresses are typically 32-44 chars of [1-9A-HJ-NP-Za-km-z]
  const solanaPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/
  if (solanaPattern.test(trimmed)) {
    return NextResponse.json({ error: 'Contract addresses are not allowed in chat.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('chat_messages')
    .insert({
      user_id: userId,
      username,
      message: trimmed,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
