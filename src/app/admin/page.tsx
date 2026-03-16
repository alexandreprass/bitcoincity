'use client'

import { useState } from 'react'
import { satoshisToBtc } from '@/lib/bitcoin'
import Navbar from '@/components/Navbar'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [buildings, setBuildings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${password}` },
      })

      if (res.status === 401) {
        setError('Invalid password')
        setLoading(false)
        return
      }

      const data = await res.json()
      setBuildings(data.buildings || [])
      setAuthenticated(true)
    } catch {
      setError('Failed to connect')
    }
    setLoading(false)
  }

  const toggleVerified = async (userId: string, currentStatus: boolean) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`,
      },
      body: JSON.stringify({ userId, verified: !currentStatus }),
    })

    if (res.ok) {
      setBuildings((prev) =>
        prev.map((b) => (b.user_id === userId ? { ...b, verified: !currentStatus } : b))
      )
    }
  }

  if (!authenticated) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center px-4 pt-16">
          <div className="card-dark w-full max-w-sm">
            <h1 className="text-xl font-bold mb-4 text-center">Admin Panel</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark"
                placeholder="Admin password"
                required
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-bitcoin w-full">
                {loading ? 'Checking...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 px-4 max-w-6xl mx-auto pb-12">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-gray-400 mb-6">{buildings.length} total citizens</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="py-3 px-2">#</th>
                <th className="py-3 px-2">Name</th>
                <th className="py-3 px-2">BTC Address</th>
                <th className="py-3 px-2">Balance</th>
                <th className="py-3 px-2">Tier</th>
                <th className="py-3 px-2">Verified</th>
                <th className="py-3 px-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b, i) => (
                <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3 px-2 text-gray-500">{i + 1}</td>
                  <td className="py-3 px-2">
                    <span className="text-white font-medium">{b.display_name || b.username}</span>
                    {b.verified && (
                      <span className="ml-1 text-yellow-400 text-xs">VERIFIED</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-xs text-gray-400">
                      {b.btc_address.slice(0, 10)}...{b.btc_address.slice(-6)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-[#f7931a]">
                    {satoshisToBtc(b.balance_satoshis).toFixed(8)}
                  </td>
                  <td className="py-3 px-2 text-gray-400">{b.height}</td>
                  <td className="py-3 px-2">
                    {b.verified ? (
                      <span className="text-yellow-400">Yes</span>
                    ) : (
                      <span className="text-gray-600">No</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => toggleVerified(b.user_id, b.verified)}
                      className={`text-xs px-3 py-1 rounded ${
                        b.verified
                          ? 'bg-red-900/50 text-red-400 hover:bg-red-900'
                          : 'bg-green-900/50 text-green-400 hover:bg-green-900'
                      }`}
                    >
                      {b.verified ? 'Remove Verified' : 'Give Verified'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
