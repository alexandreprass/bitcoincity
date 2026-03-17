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
  const [searchName, setSearchName] = useState('')
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'not_verified'>('all')
  const [verificationRequests, setVerificationRequests] = useState<any[]>([])

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

      // Also load verification requests
      await loadVerificationRequests()
    } catch {
      setError('Failed to connect')
    }
    setLoading(false)
  }

  const loadVerificationRequests = async () => {
    try {
      const res = await fetch('/api/verification-requests', {
        headers: { Authorization: `Bearer ${password}` },
      })
      if (res.ok) {
        const data = await res.json()
        setVerificationRequests(data.requests || [])
      }
    } catch {
      // ignore
    }
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

  const setAdminBuilding = async (userId: string) => {
    if (!confirm('Set this building as the ADMIN building? It will become the largest golden building in the city.')) return

    const res = await fetch('/api/admin', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`,
      },
      body: JSON.stringify({ userId }),
    })

    if (res.ok) {
      setBuildings((prev) =>
        prev.map((b) => ({ ...b, is_admin: b.user_id === userId }))
      )
    }
  }

  const removeAdminBuilding = async () => {
    const res = await fetch('/api/admin', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`,
      },
      body: JSON.stringify({ userId: null }),
    })

    if (res.ok) {
      setBuildings((prev) =>
        prev.map((b) => ({ ...b, is_admin: false }))
      )
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete ALL data for this user? This cannot be undone.')) return

    const res = await fetch(`/api/admin?userId=${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${password}` },
    })

    if (res.ok) {
      setBuildings((prev) => prev.filter((b) => b.user_id !== userId))
    }
  }

  const approveVerificationRequest = async (requestId: string) => {
    const res = await fetch('/api/verification-requests', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`,
      },
      body: JSON.stringify({ requestId }),
    })

    if (res.ok) {
      setVerificationRequests((prev) => prev.filter((r) => r.id !== requestId))
      // Refresh buildings to reflect verification changes
      const buildingsRes = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${password}` },
      })
      if (buildingsRes.ok) {
        const data = await buildingsRes.json()
        setBuildings(data.buildings || [])
      }
    }
  }

  const deleteVerificationRequest = async (requestId: string) => {
    const res = await fetch(`/api/verification-requests?id=${requestId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${password}` },
    })

    if (res.ok) {
      setVerificationRequests((prev) => prev.filter((r) => r.id !== requestId))
    }
  }

  // Filter buildings
  const filteredBuildings = buildings.filter((b) => {
    const name = (b.display_name || b.username || '').toLowerCase()
    if (searchName && !name.includes(searchName.toLowerCase())) return false
    if (filterVerified === 'verified' && !b.verified) return false
    if (filterVerified === 'not_verified' && b.verified) return false
    return true
  })

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

        {/* Manual Verification Requests */}
        {verificationRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">
              Manual Verification Requests ({verificationRequests.length})
            </h2>
            <div className="space-y-3">
              {verificationRequests.map((req) => (
                <div key={req.id} className="card-dark flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{req.display_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{req.btc_address}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      TX: <span className="font-mono text-gray-300">{req.tx_hash}</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(req.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approveVerificationRequest(req.id)}
                      className="text-xs px-3 py-1.5 rounded bg-green-900/50 text-green-400 hover:bg-green-900"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => deleteVerificationRequest(req.id)}
                      className="text-xs px-3 py-1.5 rounded bg-red-900/50 text-red-400 hover:bg-red-900"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="input-dark max-w-xs"
            placeholder="Search by name..."
          />
          <div className="flex gap-2">
            {(['all', 'verified', 'not_verified'] as const).map((val) => (
              <button
                key={val}
                onClick={() => setFilterVerified(val)}
                className={`text-xs px-3 py-2 rounded transition-colors ${
                  filterVerified === val
                    ? 'bg-[#f7931a] text-black font-semibold'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {val === 'all' ? 'All' : val === 'verified' ? 'Verified' : 'Not Verified'}
              </button>
            ))}
          </div>
        </div>

        <p className="text-gray-500 text-sm mb-2">Showing {filteredBuildings.length} of {buildings.length}</p>

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
                <th className="py-3 px-2">Admin</th>
                <th className="py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuildings.map((b, i) => (
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
                    {b.is_admin ? (
                      <span className="text-orange-400 font-bold">ADMIN</span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex gap-2">
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
                      {b.is_admin ? (
                        <button
                          onClick={() => removeAdminBuilding()}
                          className="text-xs px-3 py-1 rounded bg-orange-900/50 text-orange-400 hover:bg-orange-900"
                        >
                          Remove Admin
                        </button>
                      ) : (
                        <button
                          onClick={() => setAdminBuilding(b.user_id)}
                          className="text-xs px-3 py-1 rounded bg-orange-900/50 text-orange-300 hover:bg-orange-900"
                        >
                          Set Admin
                        </button>
                      )}
                      <button
                        onClick={() => deleteUser(b.user_id)}
                        className="text-xs px-3 py-1 rounded bg-red-900/50 text-red-400 hover:bg-red-900"
                      >
                        Delete
                      </button>
                    </div>
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
