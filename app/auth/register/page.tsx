'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedWaiver, setAcceptedWaiver] = useState(false)
  const [step, setStep] = useState<'email' | 'verify' | 'complete'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password: 'temp-password', // Will be set after verification
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error

      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!acceptedWaiver) {
      setError('Please accept the legal waiver')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      // Update password after verification
      const { error } = await supabase.auth.updateUser({
        password
      })

      if (error) throw error

      // Redirect to home or logbook
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete registration')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Register for gsyrocks
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter your email to start registration
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleEmailSubmit}>
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Verification Email'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Check Your Email
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We've sent a verification link to {email}
            </p>
          </div>
          <div className="text-center">
            <button
              onClick={() => setStep('complete')}
              className="text-blue-600 hover:text-blue-500"
            >
              I've verified my email
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Registration
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Set your password and accept the waiver
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleCompleteRegistration}>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Password"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Confirm Password"
            />
          </div>
          <div className="flex items-center">
            <input
              id="waiver"
              name="waiver"
              type="checkbox"
              checked={acceptedWaiver}
              onChange={(e) => setAcceptedWaiver(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="waiver" className="ml-2 block text-sm text-gray-900">
              I accept the legal waiver and terms of service
            </label>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Completing...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}