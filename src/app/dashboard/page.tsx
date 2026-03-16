'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { satoshisToBtc, getBuildingLabel, getBuildingColor } from '@/lib/bitcoin'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [wallet, setWallet] = useState<any>(null)
  const [building, setBuilding] = useState<any>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [totalCitizens, setTotalCitizens] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const [profileRes, walletRes, buildingRes, countRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      supabase.from('buildings').select('*').eq('user_id', user.id).single(),
      supabase.from('buildings').select('*', { count: 'exact', head: true }),
    ])

    setProfile(profileRes.data)
    setWallet(walletRes.data)
    setBuilding(buildingRes.data)
    setTotalCitizens(countRes.count || 0)

    // Calculate rank
    if (buildingRes.data) {
      const { count } = await supabase
        .from('buildings')
        .select('*', { count: 'exact', head: true })
        .gt('balance_satoshis', buildingRes.data.balance_satoshis)

      setRank((count || 0) + 1)
    }

    setLoading(false)
  }

  const handleRefreshBalance = async () => {
    if (!wallet) return
    setLoading(true)
    try {
      const res = await fetch(`/api/balance?address=${wallet.btc_address}`)
      const data = await res.json()
      if (res.ok) {
        const { getBuildingHeight, getBuildingColor } = await import('@/lib/bitcoin')
        await Promise.all([
          supabase.from('wallets').update({
            balance_satoshis: data.balance,
            last_updated: new Date().toISOString(),
          }).eq('user_id', wallet.user_id),
          supabase.from('buildings').update({
            balance_satoshis: data.balance,
            height: getBuildingHeight(data.balance),
            color: getBuildingColor(data.balance),
          }).eq('user_id', wallet.user_id),
        ])
        await loadData()
      }
    } catch (err) {
      console.error('Failed to refresh balance')
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center pt-16">
          <div className="text-gray-400">Loading...</div>
        </div>
      </>
    )
  }

  const btc = wallet ? satoshisToBtc(wallet.balance_satoshis) : 0
  const label = wallet ? getBuildingLabel(wallet.balance_satoshis) : 'No wallet'

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 px-4 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          Welcome, <span className="text-[#f7931a]">{profile?.display_name || 'Citizen'}</span>
        </h1>
        <p className="text-gray-400 mb-8">Your Bitcoin City dashboard</p>

        {!wallet ? (
          <div className="card-dark text-center py-12">
            <p className="text-xl mb-4">You haven&apos;t connected a wallet yet</p>
            <Link href="/verify-wallet" className="btn-bitcoin inline-block">
              Connect Wallet
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Building Card */}
            <div className="card-dark">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Your Tower</h2>
              <div className="flex items-end gap-4 mb-4">
                <div
                  className="rounded-sm"
                  style={{
                    width: '40px',
                    height: `${Math.max(20, (building?.height || 1) * 3)}px`,
                    maxHeight: '150px',
                    backgroundColor: building?.color || '#4A90D9',
                  }}
                />
                <div>
                  <p className="text-2xl font-bold text-white">{label}</p>
                  <p className="text-gray-400 text-sm">Height: {building?.height?.toFixed(1)} units</p>
                </div>
              </div>
              {rank && (
                <p className="text-sm text-gray-400">
                  Rank <span className="text-[#f7931a] font-bold">#{rank}</span> of {totalCitizens} citizens
                </p>
              )}
            </div>

            {/* Wallet Card */}
            <div className="card-dark">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Wallet</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Address</p>
                  <p className="text-sm font-mono text-gray-300 break-all">{wallet.btc_address}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Balance</p>
                  <p className="text-2xl font-bold text-[#f7931a]">{btc.toFixed(8)} BTC</p>
                  <p className="text-xs text-gray-500">{wallet.balance_satoshis.toLocaleString()} satoshis</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last updated</p>
                  <p className="text-sm text-gray-400">
                    {new Date(wallet.last_updated).toLocaleString()}
                  </p>
                </div>
                <button onClick={handleRefreshBalance} className="btn-bitcoin text-sm !py-2 w-full">
                  Refresh Balance
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="md:col-span-2 card-dark">
              <div className="flex flex-wrap gap-4">
                <Link href="/" className="btn-bitcoin text-sm !py-2">
                  View Bitcoin City →
                </Link>
                <Link href="/verify-wallet" className="text-gray-400 hover:text-white border border-gray-700 px-4 py-2 rounded-lg text-sm transition-colors">
                  Change Wallet
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
