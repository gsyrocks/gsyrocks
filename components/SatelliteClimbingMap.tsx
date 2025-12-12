'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import L from 'leaflet'

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'

// Fix default markers
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

interface Climb {
  id: string
  name: string
  grade: string
  image_url: string
  crags: { name: string; latitude: number; longitude: number }
}

export default function SatelliteClimbingMap() {
  const [climbs, setClimbs] = useState<Climb[]>([])
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const fetchClimbs = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('climbs')
          .select(`
            id, name, grade, image_url,
            crags (name, latitude, longitude)
          `)
          .eq('status', 'approved')

        if (error) {
          console.error('Error fetching climbs:', error)
        } else {
          setClimbs((data || []) as unknown as Climb[])
        }
      } catch (err) {
        console.error('Network error fetching climbs:', err)
      }
      setLoading(false)
    }

    fetchClimbs()
  }, [isClient])

  if (!isClient || loading) {
    return <div className="h-96 flex items-center justify-center">Loading satellite map...</div>
  }

  // World center coordinates
  const worldCenter: [number, number] = [20, 0]
  const zoom = 2

  return (
    <div className="h-96 w-full">
      <MapContainer
        center={worldCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and others'
          maxZoom={19}
          minZoom={1}
        />


        {climbs.map(climb => (
          <Marker
            key={climb.id}
            position={[climb.crags.latitude, climb.crags.longitude]}
          >
            <Popup>
              <div className="max-w-xs">
                <img
                  src={climb.image_url}
                  alt={climb.name}
                  className="w-full h-32 object-cover rounded mb-2"
                />
                <h3 className="font-semibold text-lg">{climb.name}</h3>
                <p className="text-gray-600">Grade: {climb.grade}</p>
                <p className="text-gray-600">Location: {climb.crags.name}</p>
                <a
                  href={`/climbs/${climb.id}`}
                  className="text-blue-500 hover:text-blue-700 underline mt-2 inline-block"
                >
                  View Details
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}