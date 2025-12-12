'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Auth callback error:', error)
        router.push('/auth/register?error=auth_failed')
        return
      }

      if (data.session) {
        // Check if user has completed registration (has password set)
        const { data: user } = await supabase.auth.getUser()
        if (user.user?.email_confirmed_at) {
          // Email confirmed, redirect to complete registration
          router.push('/auth/register?step=complete')
        } else {
          router.push('/auth/register')
        }
      } else {
        router.push('/auth/register')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Verifying your email...</p>
      </div>
    </div>
  )
}