import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { CHARACTER_LIST } from '@/lib/characters'

export const dynamic = 'force-dynamic'

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

  const { userId, characterId } = body

  if (!userId || !characterId) {
    return NextResponse.json({ error: 'Missing userId or characterId' }, { status: 400 })
  }

  // Validate character exists
  const validCharacter = CHARACTER_LIST.find(c => c.id === characterId)
  if (!validCharacter) {
    return NextResponse.json({ error: 'Invalid character' }, { status: 400 })
  }

  // Check change limit
  const { data: profile } = await supabase
    .from('profiles')
    .select('character_changes, character')
    .eq('id', userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if ((profile.character_changes || 0) >= 1) {
    return NextResponse.json({ error: 'You have already used your character change.' }, { status: 403 })
  }

  if (profile.character === characterId) {
    return NextResponse.json({ error: 'You already have this character.' }, { status: 400 })
  }

  // Update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      character: characterId,
      character_changes: (profile.character_changes || 0) + 1,
    })
    .eq('id', userId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Update building too
  await supabase
    .from('buildings')
    .update({ character: characterId })
    .eq('user_id', userId)

  return NextResponse.json({ success: true, character: characterId })
}
