'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isValidBtcAddress, satoshisToBtc, getBuildingLabel } from '@/lib/bitcoin'
import Navbar from '@/components/Navbar'

export default function VerifyWalletPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [balanceInfo, setBalanceInfo] = useState<{ satoshis: number; btc: number; label: string } | null>(null)
  const [dispute, setDispute] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userMeta, setUserMeta] = useState<{ username: string; displayName: string }>({ username: 'Anon', displayName: 'Anon' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/auth/login')
      } else {
        setUserId(data.user.id)
        setUserMeta({
          username: data.user.user_metadata?.username || 'Anon',
          displayName: data.user.user_metadata?.display_name || data.user.user_metadata?.username || 'Anon',
        })
      }
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setDispute(false)
    setSuccess(false)
    setBalanceInfo(null)

    const trimmed = address.trim()
    if (!isValidBtcAddress(trimmed)) {
      setError('Invalid Bitcoin address. Please enter a valid BTC address (starting with 1, 3, or bc1).')
      return
    }

    setLoading(true)

    try {
      // Call server-side API that uses service role (bypasses RLS)
      const res = await fetch('/api/connect-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          btcAddress: trimmed,
          username: userMeta.username,
          displayName: userMeta.displayName,
        }),
      })

      const data = await res.json()

      if (res.status === 409) {
        setDispute(true)
        setLoading(false)
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect wallet')
      }

      const btc = satoshisToBtc(data.balance)
      const label = getBuildingLabel(data.balance)
      setBalanceInfo({ satoshis: data.balance, btc, label })
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleDispute = async () => {
    setDispute(false)
    setError('Dispute noted. For now, please use a different wallet address, or contact support.')
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="card-dark w-full max-w-lg">
          <div className="text-center mb-8">
            <span className="text-4xl">₿</span>
            <h1 className="text-2xl font-bold mt-2">Connect Your Wallet</h1>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              Enter your Bitcoin wallet address below. We will <strong className="text-white">only read your public balance</strong> to
              determine the size of your building in Bitcoin City.
            </p>
            <div className="mt-3 bg-blue-900/30 border border-blue-800 rounded-lg px-4 py-3">
              <p className="text-blue-300 text-xs">
                🔒 <strong>Read-only access</strong> — We never ask for private keys, seed phrases, or
                any sensitive information. Your wallet address is public on the blockchain.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bitcoin Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input-dark font-mono text-sm"
                placeholder="bc1q... or 1... or 3..."
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {dispute && (
              <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold mb-2">This wallet is already claimed by another user.</p>
                <p className="text-yellow-400 text-xs mb-3">
                  If this wallet belongs to you, you can submit a dispute. Otherwise, please use a different address.
                </p>
                <button
                  type="button"
                  onClick={handleDispute}
                  className="text-yellow-300 underline text-xs hover:text-yellow-100"
                >
                  This wallet belongs to me — submit dispute
                </button>
              </div>
            )}

            {success && balanceInfo && (
              <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold text-green-200">Wallet connected successfully!</p>
                <div className="mt-2 space-y-1 text-xs">
                  <p>Balance: <span className="text-[#f7931a] font-bold">{balanceInfo.btc.toFixed(8)} BTC</span></p>
                  <p>({balanceInfo.satoshis.toLocaleString()} satoshis)</p>
                  <p>Your building: <span className="text-white font-semibold">{balanceInfo.label}</span></p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="btn-bitcoin mt-4 text-sm !py-2"
                >
                  View Your Tower →
                </button>
              </div>
            )}

            {!success && (
              <button type="submit" disabled={loading} className="btn-bitcoin w-full disabled:opacity-50">
                {loading ? 'Looking up balance...' : 'Connect Wallet'}
              </button>
            )}
          </form>
        </div>
      </div>
    </>
  )
}
