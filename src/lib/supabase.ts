import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  username: string
  display_name: string
  wallet_changes: number
  character: string
  character_changes: number
  created_at: string
}

export type Wallet = {
  id: string
  user_id: string
  btc_address: string
  balance_satoshis: number
  last_updated: string
}

export type Building = {
  id: string
  user_id: string
  username: string
  display_name: string
  btc_address: string
  balance_satoshis: number
  height: number
  position_x: number
  position_z: number
  color: string
  character: string
  verified: boolean
  message: string
  verification_deadline: string | null
  is_admin: boolean
  created_at: string
}

export type VerificationRequest = {
  id: string
  user_id: string
  btc_address: string
  tx_hash: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
