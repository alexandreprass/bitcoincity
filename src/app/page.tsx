'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import type { Building } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

const City3D = dynamic(() => import('@/components/City3D'), { ssr: false })

export default function HomePage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ citizens: 0, totalBtc: 0 })
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [drivingMode, setDrivingMode] = useState(false)
  const [walkingMode, setWalkingMode] = useState(false)

  const fetchBuildings = () => {
    fetch('/api/buildings')
      .then((res) => res.json())
      .then((data) => {
        const b = data.buildings || []
        setBuildings(b)
        setStats({
          citizens: b.length,
          totalBtc: b.reduce((sum: number, x: Building) => sum + (x.balance_satoshis || 0), 0) / 100_000_000,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
      if (data.user) {
        setUserName(data.user.user_metadata?.username || data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || 'Anon')
        setUserId(data.user.id)
      }
    })

    fetchBuildings()

    // Auto-reorganize every 10 minutes: sort buildings by size (biggest near center) and refresh
    const reorganizeInterval = setInterval(() => {
      fetch('/api/reorganize', { method: 'POST' })
        .then(() => fetchBuildings())
        .catch(() => {})
    }, 10 * 60 * 1000) // 10 minutes

    // Auto-refresh buildings every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchBuildings()
    }, 5 * 60 * 1000) // 5 minutes

    return () => {
      clearInterval(reorganizeInterval)
      clearInterval(refreshInterval)
    }
  }, [])

  return (
    <div className="relative">
      <Navbar />

      {/* Hero overlay - hidden when driving */}
      {!drivingMode && (
        <div className={`absolute top-20 left-0 right-0 z-10 text-center pointer-events-none ${isLoggedIn ? 'opacity-80' : ''}`}>
          <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-2xl">
            BITCOIN<span className="text-[#f7931a]">CITY</span>
          </h1>
          {!isLoggedIn && (
            <p className="text-lg md:text-xl text-gray-300 mt-3 drop-shadow-lg max-w-xl mx-auto px-4">
              A city where every citizen is a building.
              <br />
              The more BTC you hold, the taller your tower.
            </p>
          )}

          <div className="flex justify-center gap-8 mt-4 text-sm">
            <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-[#f7931a] font-bold text-2xl">{stats.citizens}</p>
              <p className="text-gray-400">Citizens</p>
            </div>
            <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-[#f7931a] font-bold text-2xl">{stats.totalBtc.toFixed(4)}</p>
              <p className="text-gray-400">Total BTC</p>
            </div>
          </div>

          {!isLoggedIn && (
            <div className="mt-6 pointer-events-auto">
              <Link href="/auth/signup" className="btn-bitcoin text-lg px-8 py-4 inline-block">
                Build Your Tower
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Compact stats when driving or walking */}
      {(drivingMode || walkingMode) && (
        <div className="fixed top-20 left-4 z-20 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 flex gap-4 text-xs">
          <div>
            <p className="text-[#f7931a] font-bold text-lg">{stats.citizens}</p>
            <p className="text-gray-400">Citizens</p>
          </div>
          <div>
            <p className="text-[#f7931a] font-bold text-lg">{stats.totalBtc.toFixed(4)}</p>
            <p className="text-gray-400">Total BTC</p>
          </div>
        </div>
      )}

      {/* Bottom legend - hidden when driving/walking */}
      <div className={`absolute bottom-4 left-4 z-10 bg-black/70 backdrop-blur-sm rounded-lg p-4 text-xs space-y-1 ${(drivingMode || walkingMode) ? 'hidden' : ''}`}>
        <p className="text-gray-400 font-semibold mb-2">Building Tiers</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#FFD700' }} />
          <span className="text-gray-300">100+ BTC — Mega Whale Tower</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#C0C0C0' }} />
          <span className="text-gray-300">10-100 BTC — Whale Skyscraper</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#4169E1' }} />
          <span className="text-gray-300">5-10 BTC — Diamond Tower</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#4A90D9' }} />
          <span className="text-gray-300">3-5 BTC — Platinum Building</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#5B8DEF' }} />
          <span className="text-gray-300">1-3 BTC — Holder Tower</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#50C878' }} />
          <span className="text-gray-300">0.5-1 BTC — Stacker Building</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#E8A87C' }} />
          <span className="text-gray-300">0.1-0.5 BTC — Starter House</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#8B7355' }} />
          <span className="text-gray-300">&lt;0.1 BTC — Humble Shack</span>
        </div>
      </div>

      {/* 3D City */}
      {loading ? (
        <div className="w-full h-screen flex items-center justify-center bg-[#0a0a1a]">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-pulse">₿</div>
            <p className="text-gray-400">Loading Bitcoin City...</p>
          </div>
        </div>
      ) : (
        <City3D buildings={buildings} drivingMode={drivingMode} walkingMode={walkingMode} driverName={userName} userTier={buildings.find(b => b.user_id === userId)?.height || 1} supabaseClient={supabase} />
      )}

      {/* Mode buttons - only for logged in users */}
      {isLoggedIn && !walkingMode && (
        <button
          onClick={(e) => { (e.target as HTMLButtonElement).blur(); setDrivingMode((prev) => !prev); setWalkingMode(false) }}
          onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
          className={`fixed bottom-20 right-6 z-20 px-5 py-3 rounded-xl font-bold text-sm shadow-lg transition-all duration-200 ${
            drivingMode
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-[#f7931a] hover:bg-[#e8850f] text-black'
          }`}
        >
          {drivingMode ? 'Exit Flying Mode' : 'Fly Around the City'}
        </button>
      )}
      {isLoggedIn && !drivingMode && (
        <button
          onClick={(e) => { (e.target as HTMLButtonElement).blur(); setWalkingMode((prev) => !prev); setDrivingMode(false) }}
          onKeyDown={(e) => { if (e.key === ' ') e.preventDefault() }}
          className={`fixed bottom-6 right-6 z-20 px-5 py-3 rounded-xl font-bold text-sm shadow-lg transition-all duration-200 ${
            walkingMode
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {walkingMode ? 'Exit Walking Mode' : 'Walk Around the City'}
        </button>
      )}

      {/* Controls hints */}
      {drivingMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-sm text-gray-300 text-xs px-4 py-2 rounded-lg hidden md:block">
          Shift/W = Forward &nbsp; S = Reverse &nbsp; A/D = Steer &nbsp; Up = Climb &nbsp; Down = Descend &nbsp; SPACE = Nitro
        </div>
      )}
      {walkingMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-sm text-gray-300 text-xs px-4 py-2 rounded-lg hidden md:block">
          W/S = Move &nbsp; A/D = Strafe &nbsp; Mouse Drag = Rotate Camera &nbsp; SPACE = Run
        </div>
      )}
      {/* Mobile controls hint */}
      {(drivingMode || walkingMode) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-sm text-gray-300 text-xs px-4 py-2 rounded-lg md:hidden">
          Touch = {walkingMode ? 'Walk' : 'Accelerate'} &nbsp; Drag Left/Right = Steer
        </div>
      )}
      {/* Mobile nitro/run button */}
      {drivingMode && (
        <button
          id="mobile-nitro-btn"
          onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })) }}
          className="fixed bottom-20 right-6 z-20 w-14 h-14 rounded-full bg-blue-600/80 backdrop-blur-sm text-white font-bold text-lg shadow-lg active:bg-blue-400 md:hidden flex items-center justify-center"
        >
          N
        </button>
      )}
    </div>
  )
}
