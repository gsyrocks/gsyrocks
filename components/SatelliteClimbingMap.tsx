'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
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
  const [selectedClimb, setSelectedClimb] = useState<Climb | null>(null)

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

   useEffect(() => {
     if (selectedClimb) {
       console.log('selectedClimb set to:', selectedClimb.name, 'image_url:', selectedClimb.image_url)
     }
   }, [selectedClimb])

  if (!isClient || loading) {
    return <div className="h-screen w-full flex items-center justify-center">Loading satellite map...</div>
  }

  // World center coordinates
  const worldCenter: [number, number] = [20, 0]
  const zoom = 2

  return (
    <div className="h-screen w-full">
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
            eventHandlers={{
              click: () => {
                console.log('Marker clicked for climb:', climb.name, 'image_url:', climb.image_url);
                setSelectedClimb(climb);
              },
            }}
          />
        ))}
      </MapContainer>
      {selectedClimb && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-20">
          <div className="relative w-full h-full">
            <Image
              src={selectedClimb.image_url}
              alt={selectedClimb.name}
              fill
              style={{ objectFit: 'cover' }}
              onError={() => console.log('Image failed to load:', selectedClimb.image_url)}
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-white p-4">
            <h3 className="text-lg font-semibold">{selectedClimb.name}</h3>
            <p className="text-gray-600">Grade: {selectedClimb.grade}</p>
          </div>
          <button onClick={() => setSelectedClimb(null)} className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2">X</button>
        </div>
      )}
    </div>
  )
}