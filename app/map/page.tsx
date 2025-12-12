'use client'

import dynamic from 'next/dynamic'

const SatelliteClimbingMap = dynamic(() => import('@/components/SatelliteClimbingMap'), {
  ssr: false,
  loading: () => <div className="h-96 flex items-center justify-center">Loading map...</div>
})

export default function MapPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">World Climbing Map</h1>
        <p className="mb-6 text-gray-600">
          Explore climbing locations worldwide with satellite imagery. Zoom in to discover routes near you.
        </p>
        <SatelliteClimbingMap />
      </div>
    </div>
  )
}