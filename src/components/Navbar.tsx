'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">₿</span>
          <span className="text-xl font-bold text-white">
            Bitcoin<span className="text-[#f7931a]">City</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                Dashboard
              </Link>
              <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors text-sm">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-gray-300 hover:text-white transition-colors">
                Login
              </Link>
              <Link href="/auth/signup" className="btn-bitcoin text-sm !py-2 !px-4">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
