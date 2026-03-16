'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { satoshisToBtc, getBuildingLabel, VERIFICATION_WALLET } from '@/lib/bitcoin'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

const BUILDING_COLORS = [
  '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C',
  '#3498DB', '#9B59B6', '#E91E63', '#00BCD4', '#FF5722',
  '#795548', '#607D8B', '#8BC34A', '#FF9800', '#673AB7',
  '#009688', '#F44336', '#4CAF50', '#2196F3', '#FFC107',
]

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
  const [selectedColor, setSelectedColor] = useState('')
  const [savingColor, setSavingColor] = useState(false)
  const [showManualVerify, setShowManualVerify] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [manualVerifyResult, setManualVerifyResult] = useState('')
  const [submittingManual, setSubmittingManual] = useState(false)

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
    setSelectedColor(buildingRes.data?.color || '')
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
        const { getBuildingHeight } = await import('@/lib/bitcoin')
        await Promise.all([
          supabase.from('wallets').update({
            balance_satoshis: data.balance,
            last_updated: new Date().toISOString(),
          }).eq('user_id', wallet.user_id),
          supabase.from('buildings').update({
            balance_satoshis: data.balance,
            height: getBuildingHeight(data.balance),
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

  const handleSaveColor = async (color: string) => {
    if (!building) return
    setSelectedColor(color)
    setSavingColor(true)
    await supabase
      .from('buildings')
      .update({ color })
      .eq('user_id', building.user_id)
    setSavingColor(false)
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

  const handleManualVerify = async () => {
    if (!wallet || !userId || !txHash.trim()) return
    setSubmittingManual(true)
    setManualVerifyResult('')
    try {
      const res = await fetch('/api/verification-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          btcAddress: wallet.btc_address,
          txHash: txHash.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setManualVerifyResult('success')
        setTxHash('')
        setShowManualVerify(false)
      } else {
        setManualVerifyResult(data.error || 'Failed to submit request')
      }
    } catch {
      setManualVerifyResult('Error submitting request')
    }
    setSubmittingManual(false)
  }

  // ==================== CHAT ====================
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const [chatError, setChatError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatPollRef = useRef<any>(null)

  const loadChat = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?limit=50')
      const data = await res.json()
      if (data.messages) setChatMessages(data.messages)
    } catch {}
  }, [])

  useEffect(() => {
    loadChat()
    chatPollRef.current = setInterval(loadChat, 5000) // Poll every 5s
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current) }
  }, [loadChat])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSendChat = async () => {
    if (!chatInput.trim() || !userId || !profile) return
    setSendingChat(true)
    setChatError('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username: profile.display_name || profile.username || 'Anon',
          message: chatInput.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setChatInput('')
        await loadChat()
      } else {
        setChatError(data.error || 'Failed to send')
      }
    } catch {
      setChatError('Failed to send')
    }
    setSendingChat(false)
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

  // Check if user has 1+ BTC, not verified, and deadline has passed
  const btc = wallet ? satoshisToBtc(wallet.balance_satoshis) : 0
  const label = wallet ? getBuildingLabel(wallet.balance_satoshis) : 'No wallet'

  const deadlinePassed = building?.verification_deadline &&
    !building?.verified &&
    new Date(building.verification_deadline) < new Date()

  if (deadlinePassed) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center pt-16 px-4">
          <div className="card-dark max-w-lg text-center py-12">
            <div className="text-5xl mb-4">&#9888;</div>
            <h1 className="text-2xl font-bold text-red-400 mb-4">Verification Required</h1>
            <p className="text-gray-300 mb-6">
              Verify your account to remain active in the city. This is mandatory for all holders with more than 1 BTC.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Your verification deadline has passed. Please complete the verification process to restore your building in Bitcoin City.
            </p>
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <p className="text-xs text-gray-500 mb-1">Send BTC to verify:</p>
              <p className="text-xs font-mono text-[#f7931a] break-all select-all">{VERIFICATION_WALLET}</p>
            </div>
            <button
              onClick={() => {
                // Allow them to verify even from this screen
                setShowVerify(true)
                // Remove the blocking by resetting deadline check temporarily
                if (building) {
                  setBuilding({ ...building, verification_deadline: null })
                }
              }}
              className="btn-bitcoin"
            >
              Start Verification
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 px-4 max-w-4xl mx-auto pb-12">
        {/* View Bitcoin City button at top */}
        <div className="mb-6">
          <Link href="/" className="btn-bitcoin text-sm !py-3 !px-6 inline-block">
            View Bitcoin City
          </Link>
        </div>

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
                    backgroundColor: selectedColor || building?.color || '#4A90D9',
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

              {/* Verification deadline warning */}
              {building?.verification_deadline && !building?.verified && (
                <div className="mt-3 bg-yellow-900/30 border border-yellow-800 rounded-lg p-3">
                  <p className="text-yellow-300 text-xs">
                    Verification required by {new Date(building.verification_deadline).toLocaleDateString()}
                  </p>
                </div>
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

            {/* Color Picker */}
            <div className="card-dark">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Building Color</h2>
              <p className="text-xs text-gray-500 mb-3">Choose a color for your building in the city.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {BUILDING_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleSaveColor(color)}
                    className="w-8 h-8 rounded-md border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: selectedColor === color ? '#ffffff' : 'transparent',
                      transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                    }}
                    title={color}
                  />
                ))}
              </div>
              {savingColor && <p className="text-xs text-gray-500">Saving...</p>}
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

                  {/* Manual Verification Request */}
                  <div className="mt-3 border-t border-gray-800 pt-3">
                    {!showManualVerify ? (
                      <button
                        onClick={() => setShowManualVerify(true)}
                        className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors"
                      >
                        Request Manual Verification
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">Enter the transaction hash of your payment:</p>
                        <input
                          type="text"
                          value={txHash}
                          onChange={(e) => setTxHash(e.target.value)}
                          className="input-dark text-xs font-mono"
                          placeholder="Transaction hash (e.g. abc123...)"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleManualVerify}
                            disabled={submittingManual || !txHash.trim()}
                            className="btn-bitcoin text-xs !py-1.5 !px-3"
                          >
                            {submittingManual ? 'Submitting...' : 'Submit Request'}
                          </button>
                          <button
                            onClick={() => { setShowManualVerify(false); setTxHash('') }}
                            className="text-xs text-gray-500 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                        {manualVerifyResult === 'success' && (
                          <p className="text-green-400 text-xs">Request submitted! An admin will review it.</p>
                        )}
                        {manualVerifyResult && manualVerifyResult !== 'success' && (
                          <p className="text-red-400 text-xs">{manualVerifyResult}</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="md:col-span-2 card-dark">
              <div className="flex flex-wrap gap-4 items-center">
                {walletChangesLeft > 0 ? (
                  <Link href="/verify-wallet" className="text-gray-400 hover:text-white border border-gray-700 px-4 py-2 rounded-lg text-sm transition-colors">
                    Change Wallet ({walletChangesLeft} left)
                  </Link>
                ) : (
                  <span className="text-gray-600 text-sm px-4 py-2">Wallet change limit reached (0 left)</span>
                )}
              </div>
            </div>

            {/* City Chat */}
            <div className="md:col-span-2 card-dark">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">City Chat</h2>
              <div className="bg-gray-900/50 rounded-lg border border-gray-800 h-64 overflow-y-auto p-3 mb-3 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-gray-600 text-sm text-center mt-8">No messages yet. Be the first to say something!</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={msg.id || i} className="text-sm">
                    <span className="text-[#f7931a] font-semibold">{msg.username}</span>
                    <span className="text-gray-600 text-xs ml-2">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <p className="text-gray-300 mt-0.5 break-words">{msg.message}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !sendingChat) handleSendChat() }}
                  className="input-dark text-sm flex-1"
                  placeholder="Type a message..."
                  maxLength={500}
                />
                <button
                  onClick={handleSendChat}
                  disabled={sendingChat || !chatInput.trim()}
                  className="btn-bitcoin text-sm !py-2 !px-4"
                >
                  {sendingChat ? '...' : 'Send'}
                </button>
              </div>
              {chatError && <p className="text-red-400 text-xs mt-1">{chatError}</p>}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
