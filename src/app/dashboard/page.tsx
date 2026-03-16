'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { satoshisToBtc, getBuildingLabel, VERIFICATION_WALLET } from '@/lib/bitcoin'
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
  const [message, setMessage] = useState('')
  const [savingMessage, setSavingMessage] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setUserId(user.id)

    const [profileRes, walletRes, buildingRes, countRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      supabase.from('buildings').select('*').eq('user_id', user.id).single(),
      supabase.from('buildings').select('*', { count: 'exact', head: true }),
    ])

    setProfile(profileRes.data)
    setWallet(walletRes.data)
    setBuilding(buildingRes.data)
    setMessage(buildingRes.data?.message || '')
    setTotalCitizens(countRes.count || 0)

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

  const handleSaveMessage = async () => {
    if (!building) return
    setSavingMessage(true)
    await supabase
      .from('buildings')
      .update({ message: message.slice(0, 200) })
      .eq('user_id', building.user_id)
    setSavingMessage(false)
  }

  const handleVerify = async () => {
    if (!wallet || !userId) return
    setVerifying(true)
    setVerifyResult('')
    try {
      const res = await fetch('/api/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, btcAddress: wallet.btc_address }),
      })
      const data = await res.json()
      if (data.verified) {
        setVerifyResult('success')
        await loadData()
      } else {
        setVerifyResult('not_found')
      }
    } catch {
      setVerifyResult('error')
    }
    setVerifying(false)
  }

  const walletChangesLeft = profile ? 3 - (profile.wallet_changes || 0) : 3

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
      <div className="min-h-screen pt-24 px-4 max-w-4xl mx-auto pb-12">
        <h1 className="text-3xl font-bold mb-2">
          Welcome, <span className="text-[#f7931a]">{profile?.display_name || 'Citizen'}</span>
          {building?.verified && (
            <span className="ml-2 bg-yellow-500/20 text-yellow-400 text-sm px-3 py-1 rounded-full border border-yellow-500/50 font-semibold align-middle">
              VERIFIED
            </span>
          )}
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
                    height: `${Math.max(20, (building?.height || 1) * 18)}px`,
                    maxHeight: '150px',
                    backgroundColor: building?.color || '#4A90D9',
                    border: building?.verified ? '2px solid #FFD700' : 'none',
                    boxShadow: building?.verified ? '0 0 10px rgba(255,215,0,0.4)' : 'none',
                  }}
                />
                <div>
                  <p className="text-2xl font-bold text-white">{label}</p>
                  <p className="text-gray-400 text-sm">Tier {building?.height || 1} of 8</p>
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
                  <p className="text-sm text-gray-400">{new Date(wallet.last_updated).toLocaleString()}</p>
                </div>
                <button onClick={handleRefreshBalance} className="btn-bitcoin text-sm !py-2 w-full">
                  Refresh Balance
                </button>
              </div>
            </div>

            {/* Building Message */}
            <div className="card-dark">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Building Message</h2>
              <p className="text-xs text-gray-500 mb-2">Shown when someone clicks your building.</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input-dark text-sm h-24 resize-none"
                placeholder="Write a message for visitors..."
                maxLength={200}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">{message.length}/200</span>
                <button onClick={handleSaveMessage} disabled={savingMessage} className="btn-bitcoin text-sm !py-2 !px-4">
                  {savingMessage ? 'Saving...' : 'Save Message'}
                </button>
              </div>
            </div>

            {/* Verification */}
            <div className="card-dark">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">
                Wallet Verification
                {building?.verified && <span className="ml-2 text-yellow-400 text-sm">Verified</span>}
              </h2>
              {building?.verified ? (
                <div className="bg-green-900/30 border border-green-800 rounded-lg p-4">
                  <p className="text-green-300 text-sm">Your wallet is verified! Your building has a golden aura in the city.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    Verify your wallet to get a golden aura and a verified badge. Send at least $10 in BTC to the address below.
                  </p>
                  <div className="bg-gray-800 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-500 mb-1">Send BTC to:</p>
                    <p className="text-xs font-mono text-[#f7931a] break-all select-all">{VERIFICATION_WALLET}</p>
                  </div>
                  {!showVerify ? (
                    <button onClick={() => setShowVerify(true)} className="btn-bitcoin text-sm !py-2 w-full">
                      Verify Wallet
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-300">
                        After sending, click &quot;Confirm Payment&quot; and we&apos;ll check the blockchain.
                      </p>
                      <button onClick={handleVerify} disabled={verifying} className="btn-bitcoin text-sm !py-2 w-full">
                        {verifying ? 'Checking blockchain...' : 'Confirm Payment'}
                      </button>
                      {verifyResult === 'success' && <p className="text-green-400 text-sm">Verified! Golden aura activated.</p>}
                      {verifyResult === 'not_found' && <p className="text-yellow-400 text-sm">Transaction not found yet. Try again later.</p>}
                      {verifyResult === 'error' && <p className="text-red-400 text-sm">Error checking. Please try again.</p>}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="md:col-span-2 card-dark">
              <div className="flex flex-wrap gap-4 items-center">
                <Link href="/" className="btn-bitcoin text-sm !py-2">
                  View Bitcoin City
                </Link>
                {walletChangesLeft > 0 ? (
                  <Link href="/verify-wallet" className="text-gray-400 hover:text-white border border-gray-700 px-4 py-2 rounded-lg text-sm transition-colors">
                    Change Wallet ({walletChangesLeft} left)
                  </Link>
                ) : (
                  <span className="text-gray-600 text-sm px-4 py-2">Wallet change limit reached (0 left)</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
