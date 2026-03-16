'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import type { Building } from '@/lib/supabase'

const City3D = dynamic(() => import('@/components/City3D'), { ssr: false })

export default function HomePage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ citizens: 0, totalBtc: 0 })

  useEffect(() => {
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
  }, [])

  return (
    <div className="relative">
      <Navbar />

      {/* Hero overlay */}
      <div className="absolute top-20 left-0 right-0 z-10 text-center pointer-events-none">
        <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-2xl">
          BITCOIN<span className="text-[#f7931a]">CITY</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mt-3 drop-shadow-lg max-w-xl mx-auto px-4">
          A city where every citizen is a building.
          <br />
          The more BTC you hold, the taller your tower.
        </p>

        <div className="flex justify-center gap-8 mt-6 text-sm">
          <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-[#f7931a] font-bold text-2xl">{stats.citizens}</p>
            <p className="text-gray-400">Citizens</p>
          </div>
          <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-[#f7931a] font-bold text-2xl">{stats.totalBtc.toFixed(4)}</p>
            <p className="text-gray-400">Total BTC</p>
          </div>
        </div>

        <div className="mt-6 pointer-events-auto">
          <Link href="/auth/signup" className="btn-bitcoin text-lg px-8 py-4 inline-block">
            Build Your Tower
          </Link>
        </div>
      </div>

      {/* Bottom legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 backdrop-blur-sm rounded-lg p-4 text-xs space-y-1">
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
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#4A90D9' }} />
          <span className="text-gray-300">1-10 BTC — Holder Tower</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#50C878' }} />
          <span className="text-gray-300">0.1-1 BTC — Stacker Building</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#E8A87C' }} />
          <span className="text-gray-300">0.01-0.1 BTC — Starter House</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#8B7355' }} />
          <span className="text-gray-300">&lt;0.01 BTC — Humble Shack</span>
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
        <City3D buildings={buildings} />
      )}
    </div>
  )
}
