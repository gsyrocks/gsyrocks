'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface RouteData {
  imageUrl: string
  latitude: number
  longitude: number
  routes: { x: number; y: number }[][]
  sessionId: string
}

interface RouteForm {
  name: string
  grade: string
  description: string
}

export default function NameRoutesForm({ sessionId }: { sessionId: string }) {
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [forms, setForms] = useState<RouteForm[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const data = localStorage.getItem('routeSession')
    if (data) {
      const parsed = JSON.parse(data) as RouteData
      setRouteData(parsed)
      setForms(parsed.routes.map(() => ({ name: '', grade: 'V0', description: '' })))
    }
  }, [sessionId])

  const handleFormChange = (index: number, field: keyof RouteForm, value: string) => {
    setForms(prev => prev.map((form, i) => i === index ? { ...form, [field]: value } : form))
  }

  const handleSubmit = async () => {
    if (!routeData || forms.some(form => !form.name)) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      // First, check if crag exists or create it
      let { data: crag } = await supabase
        .from('crags')
        .select('id')
        .eq('latitude', routeData.latitude)
        .eq('longitude', routeData.longitude)
        .single()

      if (!crag) {
        const { data: newCrag, error } = await supabase
          .from('crags')
          .insert({
            latitude: routeData.latitude,
            longitude: routeData.longitude,
            name: `Crag at ${routeData.latitude.toFixed(4)}, ${routeData.longitude.toFixed(4)}`
          })
          .select('id')
          .single()

        if (error) throw error
        crag = newCrag
      }

      // Create climbs
      const climbs = forms.map((form, index) => ({
        crag_id: crag.id,
        name: form.name,
        grade: form.grade,
        description: form.description,
        coordinates: routeData.routes[index],
        image_url: routeData.imageUrl,
        created_by: user.id,
        status: 'pending'
      }))

      const { error } = await supabase
        .from('climbs')
        .insert(climbs)

      if (error) throw error

      // Clear session and redirect
      localStorage.removeItem('routeSession')
      alert('Routes submitted for approval!')
      window.location.href = '/'

    } catch (error) {
      console.error('Submit error:', error)
      alert('Failed to submit routes')
    } finally {
      setSubmitting(false)
    }
  }

  if (!routeData) {
    return <div>Loading route data...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <img src={routeData.imageUrl} alt="Routes" className="w-full h-auto rounded" />
      </div>
      {forms.map((form, index) => (
        <div key={index} className="mb-6 p-4 border rounded">
          <h3 className="text-lg font-semibold mb-4">Route {index + 1}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFormChange(index, 'name', e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grade</label>
              <select
                value={form.grade}
                onChange={(e) => handleFormChange(index, 'grade', e.target.value)}
                className="w-full p-2 border rounded"
              >
                {Array.from({ length: 18 }, (_, i) => `V${i}`).map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => handleFormChange(index, 'description', e.target.value)}
              className="w-full p-2 border rounded"
              rows={3}
            />
          </div>
        </div>
      ))}
      <button
        onClick={handleSubmit}
        disabled={submitting || forms.some(form => !form.name)}
        className="w-full bg-blue-500 text-white py-3 px-6 rounded disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit for Approval'}
      </button>
    </div>
  )
}