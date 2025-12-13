'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function Header() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <img src="/logo.png" alt="gsyrocks" className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center space-x-4">
          <Link href="/map" className="text-gray-600 hover:text-gray-900">
            Map
          </Link>
          <Link href="/upload" className="text-gray-600 hover:text-gray-900">
            Upload Route
          </Link>
          {user ? (
            <>
              <Link href="/logbook" className="text-gray-600 hover:text-gray-900">
                My Logbook
              </Link>
              <span className="text-gray-600">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">
                Login
              </Link>
              <Link href="/auth/register" className="text-blue-600 hover:text-blue-700">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}