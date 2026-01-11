'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'
import type { Crag, Region } from '@/lib/submission-types'
import LocationPickerModal from './LocationPickerModal'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false })

interface NearbyCrag {
  id: string
  name: string
  latitude: number
  longitude: number
  rock_type: string | null
  type: string
  distance_km: number
  contains_point: boolean
}

interface CragSelectorProps {
  region: Region
  latitude: number
  longitude: number
  onSelect: (crag: Crag) => void
  onCreateNew?: (name: string) => void
  selectedCragId?: string | null
}

export default function CragSelector({
  region,
  latitude,
  longitude,
  onSelect,
  onCreateNew,
  selectedCragId
}: CragSelectorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Crag[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newCragName, setNewCragName] = useState('')
  const [newCragLat, setNewCragLat] = useState('')
  const [newCragLng, setNewCragLng] = useState('')
  const [newCragRockType, setNewCragRockType] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [nearbyCrags, setNearbyCrags] = useState<NearbyCrag[]>([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null)

  useEffect(() => {
    import('leaflet').then(L => {
      setLeaflet(L)
    })
  }, [])

  const hasGps = latitude !== 0 && longitude !== 0 && !isNaN(latitude) && !isNaN(longitude)

  const loadNearbyCrags = useCallback(async () => {
    if (!hasGps) return

    setLoadingNearby(true)
    try {
      const params = new URLSearchParams({
        lat: latitude.toString(),
        lng: longitude.toString(),
        radius_km: '10'
      })
      const response = await fetch(`/api/crags/by-location?${params}`)
      if (response.ok) {
        const data = await response.json()
        setNearbyCrags(data)
      }
    } catch (error) {
      console.error('Error loading nearby crags:', error)
    } finally {
      setLoadingNearby(false)
    }
  }, [hasGps, latitude, longitude])

  useEffect(() => {
    if (hasGps && !showCreate) {
      loadNearbyCrags()
    }
  }, [hasGps, showCreate, loadNearbyCrags])

  const searchCrags = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    setErrorMessage('')
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        region_id: region.id
      })
      const response = await fetch(`/api/crags/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setErrorMessage(errorData.error || 'Failed to search crags')
        setResults([])
      }
    } catch (error) {
      console.error('Error searching crags:', error)
      setErrorMessage('Failed to search crags')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [region.id])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchCrags(query)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchCrags])

  const handleSelect = (crag: Crag) => {
    setQuery(crag.name)
    setResults([])
    setSuccessMessage('')
    setErrorMessage('')
    onSelect(crag)
  }

  const handleSelectNearby = (crag: NearbyCrag) => {
    const fullCrag: Crag = {
      id: crag.id,
      name: crag.name,
      latitude: crag.latitude,
      longitude: crag.longitude,
      region_id: null,
      description: null,
      access_notes: null,
      rock_type: crag.rock_type,
      type: crag.type as 'sport' | 'boulder' | 'trad' | 'mixed',
      boundary: null,
      created_at: ''
    }
    handleSelect(fullCrag)
  }

  const handleCreate = async () => {
    if (!newCragName.trim()) return

    const lat = parseFloat(newCragLat) || latitude
    const lng = parseFloat(newCragLng) || longitude

    if (isNaN(lat) || isNaN(lng)) {
      setErrorMessage('Valid latitude and longitude are required')
      return
    }

    setIsCreating(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/crags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCragName.trim(),
          latitude: lat,
          longitude: lng,
          region_id: region.id,
          rock_type: newCragRockType.trim() || null
        }),
      })

      if (response.ok) {
        const newCrag = await response.json()
        setSuccessMessage(`Crag "${newCrag.name}" created successfully!`)
        setShowCreate(false)
        setNewCragName('')
        setNewCragLat('')
        setNewCragLng('')
        setNewCragRockType('')
        setQuery(newCrag.name)
        onSelect(newCrag)
        onCreateNew?.(newCrag.name)
        setResults([newCrag])
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create crag' }))
        
        if (errorData.code === 'DUPLICATE' && errorData.existingCragId) {
          setErrorMessage(errorData.error)
          setTimeout(() => {
            setShowCreate(false)
            setNewCragName('')
            setNewCragLat('')
            setNewCragLng('')
            setNewCragRockType('')
            setQuery(errorData.existingCragName)
            searchCrags(errorData.existingCragName)
          }, 2000)
        } else if (errorData.code === 'DUPLICATE_NAME' && errorData.existingCragId) {
          setErrorMessage(errorData.error)
          setTimeout(() => {
            setShowCreate(false)
            setNewCragName('')
            setNewCragLat('')
            setNewCragLng('')
            setNewCragRockType('')
            setQuery(errorData.existingCragName)
            searchCrags(errorData.existingCragName)
          }, 2000)
        } else {
          const errorDetail = errorData.details || ''
          setErrorMessage(errorData.error + (errorDetail ? `: ${errorDetail}` : ''))
        }
      }
    } catch (error) {
      console.error('Error creating crag:', error)
      setErrorMessage('Failed to create crag. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancelCreate = () => {
    setShowCreate(false)
    setNewCragName('')
    setNewCragLat('')
    setNewCragLng('')
    setNewCragRockType('')
    setErrorMessage('')
  }

  const handleShowCreate = () => {
    setShowCreate(true)
    setErrorMessage('')
    setSuccessMessage('')
    setNewCragLat(latitude ? latitude.toFixed(6) : '')
    setNewCragLng(longitude ? longitude.toFixed(6) : '')
  }

  return (
    <div className="crag-selector">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        Crags in <span className="font-medium text-gray-900 dark:text-gray-100">{region.name}</span>
      </div>

      {successMessage && (
        <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {hasGps && !showCreate && (
        <div className="mb-4">
          <div className="h-48 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <MapContainer
              center={[latitude, longitude]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              dragging={false}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {leaflet && (
                <>
                  <Marker
                    position={[latitude, longitude]}
                    icon={leaflet.divIcon({
                      className: 'gps-marker',
                      iconSize: [16, 16],
                      iconAnchor: [8, 8]
                    })}
                  />
                  <Circle
                    center={[latitude, longitude]}
                    radius={1000}
                    pathOptions={{
                      color: '#3b82f6',
                      fillColor: '#3b82f6',
                      fillOpacity: 0.1,
                      weight: 1
                    }}
                  />
                  {nearbyCrags.filter(c => c.distance_km <= 10).slice(0, 20).map((crag) => (
                    <Marker
                      key={crag.id}
                      position={[crag.latitude, crag.longitude]}
                      icon={leaflet.divIcon({
                        className: 'crag-marker',
                        iconSize: crag.contains_point ? [20, 20] : [12, 12],
                        iconAnchor: crag.contains_point ? [10, 10] : [6, 6]
                      })}
                    />
                  ))}
                </>
              )}
            </MapContainer>
          </div>

          {loadingNearby ? (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Loading nearby crags...
            </div>
          ) : nearbyCrags.length > 0 ? (
            <div className="mt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {nearbyCrags.length} crag{nearbyCrags.length !== 1 ? 's' : ''} within 10km
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {nearbyCrags.map((crag) => (
                  <button
                    key={crag.id}
                    onClick={() => handleSelectNearby(crag)}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      selectedCragId === crag.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{crag.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {crag.distance_km.toFixed(1)} km
                        {crag.contains_point && ' ✓'}
                      </span>
                    </div>
                    {crag.rock_type && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{crag.rock_type}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No crags found nearby
            </div>
          )}
        </div>
      )}

      {showCreate ? (
        <div className="space-y-3">
          <input
            type="text"
            value={newCragName}
            onChange={(e) => setNewCragName(e.target.value)}
            placeholder="Enter crag name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              type="text"
              value={newCragLat}
              onChange={(e) => setNewCragLat(e.target.value)}
              placeholder="Latitude"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={newCragLng}
              onChange={(e) => setNewCragLng(e.target.value)}
              placeholder="Longitude"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowLocationPicker(true)}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
              title="Select from map"
            >
              📍
            </button>
          </div>
          <input
            type="text"
            value={newCragRockType}
            onChange={(e) => setNewCragRockType(e.target.value)}
            placeholder="Rock type (optional, e.g., limestone, granite)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newCragName.trim() || isCreating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating && (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              )}
              {isCreating ? 'Creating...' : 'Create Crag'}
            </button>
            <button
              onClick={handleCancelCreate}
              disabled={isCreating}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setResults([])
                setSuccessMessage('')
                setErrorMessage('')
              }}
              placeholder="Search for a crag..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onFocus={() => {
                if (query.length >= 2) searchCrags(query)
              }}
            />

            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            )}

            {results.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                {results.map((crag) => (
                  <li
                    key={crag.id}
                    onClick={() => handleSelect(crag)}
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedCragId === crag.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {crag.name}
                    </div>
                    {crag.rock_type && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {crag.rock_type}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {query.length >= 2 && !loading && results.length === 0 && !successMessage && (
              <div className="absolute z-10 w-full mt-1 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg text-sm text-gray-500 dark:text-gray-400 text-center">
                No crags found matching &quot;{query}&quot;
              </div>
            )}
          </div>

          <button
            onClick={handleShowCreate}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            + Create new crag
          </button>
        </>
      )}

      {showLocationPicker && (
        <LocationPickerModal
          initialLat={parseFloat(newCragLat) || (latitude && latitude !== 0 ? latitude : null)}
          initialLng={parseFloat(newCragLng) || (longitude && longitude !== 0 ? longitude : null)}
          onSelect={(lat, lng) => {
            setNewCragLat(lat.toFixed(6))
            setNewCragLng(lng.toFixed(6))
            setShowLocationPicker(false)
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      <style jsx global>{`
        .gps-marker {
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .crag-marker {
          background: #ef4444;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  )
}
