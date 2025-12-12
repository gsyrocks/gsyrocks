'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LogbookPage() {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    const fetchLogs = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('logs') // Assuming a logs table
          .select('*')
          .eq('user_id', user.id)

        setLogs(data || [])
      }
    }

    fetchLogs()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Climbing Logbook</h1>
      <div className="bg-white p-6 rounded shadow">
        <p className="text-gray-600">Logbook feature coming soon. {logs.length} logs loaded.</p>
        <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
          Add New Log
        </button>
      </div>
    </div>
  )
}