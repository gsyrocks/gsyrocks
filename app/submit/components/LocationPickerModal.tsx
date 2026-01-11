'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })

const DEFAULT_LAT = 49.45
const DEFAULT_LNG = -2.58
const DEFAULT_ZOOM = 10

interface LocationPickerModalProps {
  initialLat: number | null
  initialLng: number | null
  onSelect: (lat: number, lng: number) => void
  onClose: () => void
}

export default function LocationPickerModal({
  initialLat,
  initialLng,
  onSelect,
  onClose
}: LocationPickerModalProps) {
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null)
  const [selectedLat, setSelectedLat] = useState<number | null>(initialLat)
  const [selectedLng, setSelectedLng] = useState<number | null>(initialLng)
  const mapRef = useRef<L.Map | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    import('leaflet').then(L => {
      setLeaflet(L)
    })
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current && leaflet && selectedLat !== null && selectedLng !== null) {
      const map = mapInstanceRef.current
      const handleMapClick = (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng
        setSelectedLat(lat)
        setSelectedLng(lng)
      }
      map.on('click', handleMapClick)
      return () => {
        map.off('click', handleMapClick)
      }
    }
  }, [leaflet, selectedLat, selectedLng])

  const handleMarkerDrag = useCallback((e: L.LeafletEvent) => {
    if (!leaflet) return
    const marker = e.target as L.Marker
    const position = marker.getLatLng()
    setSelectedLat(position.lat)
    setSelectedLng(position.lng)
  }, [leaflet])

  const handleConfirm = () => {
    if (selectedLat !== null && selectedLng !== null) {
      onSelect(selectedLat, selectedLng)
    }
  }

  const mapCenter: [number, number] = [
    selectedLat ?? (initialLat ?? DEFAULT_LAT),
    selectedLng ?? (initialLng ?? DEFAULT_LNG)
  ]

  const hasInitialLocation = initialLat !== null && initialLng !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Select Location</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {hasInitialLocation 
              ? 'Drag the marker to adjust the location.' 
              : 'Click on the map to select the crag location.'}
          </p>
        </div>

        <div className="relative h-80">
          <MapContainer
            center={mapCenter}
            zoom={hasInitialLocation ? 14 : DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
            dragging={true}
            zoomControl={true}
            ref={(ref) => {
              if (ref) mapInstanceRef.current = ref
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {leaflet && selectedLat !== null && selectedLng !== null && (
              <Marker
                position={[selectedLat, selectedLng]}
                icon={leaflet.divIcon({
                  className: 'climb-marker',
                  iconSize: [12, 12],
                  iconAnchor: [6, 6]
                })}
                draggable={true}
                eventHandlers={{
                  dragend: handleMarkerDrag
                }}
              />
            )}
          </MapContainer>
          {!selectedLat && !selectedLng && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm">
                Click map to place marker
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {selectedLat !== null && selectedLng !== null && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Selected: {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
            </p>
          )}
        </div>

        <div className="p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedLat === null || selectedLng === null}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select Location
          </button>
        </div>
      </div>
    </div>
  )
}
