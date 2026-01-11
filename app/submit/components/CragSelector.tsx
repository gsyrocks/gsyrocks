'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'
import type { Crag, Region } from '@/lib/submission-types'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false })

interface ExistingCragMatch {
  exists: boolean
  crag: {
    id: string
    name: string
    latitude: number
    longitude: number
    rock_type: string | null
    type: string
    radius_meters: number | null
    distanceMeters: number
  }
  message?: string
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
  const [newCragRockType, setNewCragRockType] = useState('')
  const [newCragLat, setNewCragLat] = useState('')
  const [newCragLng, setNewCragLng] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [nearbyCrags, setNearbyCrags] = useState<Crag[]>([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [existingMatch, setExistingMatch] = useState<ExistingCragMatch | null>(null)
  const [checkingTag, setCheckingTag] = useState(false)
  const [tagChecked, setTagChecked] = useState(false)
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
        q: '',
        region_id: region.id
      })
      const response = await fetch(`/api/crags/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setNearbyCrags(data)
      }
    } catch (error) {
      console.error('Error loading nearby crags:', error)
    } finally {
      setLoadingNearby(false)
    }
  }, [hasGps, region.id])

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

  const checkTagValidity = useCallback(async (tagName: string) => {
    if (!hasGps || !tagName || tagName.length < 2) {
      setExistingMatch(null)
      setTagChecked(true)
      return
    }

    setCheckingTag(true)
    setTagChecked(false)
    try {
      const params = new URLSearchParams({
        name: tagName,
        region_id: region.id,
        lat: latitude.toString(),
        lng: longitude.toString()
      })
      const response = await fetch(`/api/crags/check-tag?${params}`)
      if (response.ok) {
        const data = await response.json()
        setExistingMatch(data)
      } else {
        setExistingMatch(null)
      }
    } catch (error) {
      console.error('Error checking tag:', error)
      setExistingMatch(null)
    } finally {
      setCheckingTag(false)
      setTagChecked(true)
    }
  }, [hasGps, latitude, longitude, region.id])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setExistingMatch(null)
    setTagChecked(false)
    checkTagValidity(value)
  }

  const handleSelect = (crag: Crag) => {
    setQuery(crag.name)
    setResults([])
    setSuccessMessage('')
    setErrorMessage('')
    onSelect(crag)
  }

  const handleUseExisting = () => {
    if (existingMatch?.crag) {
      const crag: Crag = {
        id: existingMatch.crag.id,
        name: existingMatch.crag.name,
        latitude: existingMatch.crag.latitude,
        longitude: existingMatch.crag.longitude,
        region_id: region.id,
        description: null,
        access_notes: null,
        rock_type: existingMatch.crag.rock_type,
        type: existingMatch.crag.type as 'sport' | 'boulder' | 'trad' | 'mixed',
        radius_meters: existingMatch.crag.radius_meters,
        boundary: null,
        created_at: ''
      }
      handleSelect(crag)
    }
  }

  const handleMarkerDrag = useCallback((e: L.LeafletEvent) => {
    if (!leaflet) return
    const marker = e.target as L.Marker
    const position = marker.getLatLng()
    setNewCragLat(position.lat.toFixed(6))
    setNewCragLng(position.lng.toFixed(6))
  }, [leaflet])

  const handleCreate = async () => {
    const nameToCreate = showCreate ? newCragName : query
    if (!nameToCreate.trim()) {
      setErrorMessage('Crag name is required')
      return
    }

    if (existingMatch?.exists) {
      setErrorMessage(existingMatch.message || 'A crag with this name exists nearby')
      return
    }

    const lat = parseFloat(newCragLat) || latitude
    const lng = parseFloat(newCragLng) || longitude

    if (isNaN(lat) || isNaN(lng)) {
      setErrorMessage('Valid GPS location is required')
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
          name: nameToCreate.trim(),
          region_id: region.id,
          rock_type: newCragRockType.trim() || null,
          latitude: lat,
          longitude: lng
        }),
      })

      if (response.ok) {
        const newCrag = await response.json()
        setSuccessMessage(`Crag "${newCrag.name}" created!`)
        setShowCreate(false)
        setNewCragName('')
        setNewCragRockType('')
        setNewCragLat('')
        setNewCragLng('')
        setQuery(newCrag.name)
        onSelect(newCrag)
        onCreateNew?.(newCrag.name)
        setResults([newCrag])
        setExistingMatch(null)
        setTagChecked(false)
        setTimeout(() => setSuccessMessage(''), 5000)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create crag' }))
        
        if (errorData.code === 'DUPLICATE_NEARBY' && errorData.existingCragId) {
          setErrorMessage(errorData.error)
          setTimeout(() => {
            setShowCreate(false)
            setNewCragName('')
            setNewCragRockType('')
            setQuery(errorData.existingCragName)
            searchCrags(errorData.existingCragName)
          }, 2000)
        } else if (errorData.code === 'DUPLICATE' && errorData.existingCragId) {
          setErrorMessage(errorData.error)
          setTimeout(() => {
            setShowCreate(false)
            setNewCragName('')
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
    setNewCragRockType('')
    setNewCragLat('')
    setNewCragLng('')
    setErrorMessage('')
  }

  const handleShowCreate = () => {
    setShowCreate(true)
    setErrorMessage('')
    setSuccessMessage('')
    setNewCragName(query)
    setNewCragLat(hasGps ? latitude.toFixed(6) : '')
    setNewCragLng(hasGps ? longitude.toFixed(6) : '')
    checkTagValidity(query)
  }

  const handleEnterPressed = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (existingMatch?.exists) {
        handleUseExisting()
      } else if (query.trim() && tagChecked && !checkingTag) {
        handleCreate()
      }
    }
  }

  const handleSelectFromDropdown = (crag: Crag) => {
    handleSelect(crag)
    setResults([])
    setQuery(crag.name)
  }

  const hasArea = nearbyCrags.length > 0

  return (
    <div className="crag-selector">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        Crags in <span className="font-medium text-gray-900 dark:text-gray-100">{region.name}</span>
        {hasArea && (
          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
            {nearbyCrags.length} crag{nearbyCrags.length !== 1 ? 's' : ''}
          </span>
        )}
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
          <div className="h-48 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 relative">
            <MapContainer
              center={[latitude, longitude]}
              zoom={13}
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
                      iconSize: [20, 20],
                      iconAnchor: [10, 10]
                    })}
                  />
                  <Circle
                    center={[latitude, longitude]}
                    radius={2000}
                    pathOptions={{
                      color: '#3b82f6',
                      fillColor: '#3b82f6',
                      fillOpacity: 0.1,
                      weight: 1
                    }}
                  />
                  {nearbyCrags.slice(0, 20).map((crag) => (
                    <Marker
                      key={crag.id}
                      position={[crag.latitude, crag.longitude]}
                      icon={leaflet.divIcon({
                        className: 'crag-marker',
                        iconSize: [12, 12],
                        iconAnchor: [6, 6]
                      })}
                    />
                  ))}
                </>
              )}
            </MapContainer>
            <div className="absolute top-2 left-2 bg-white/90 dark:bg-gray-900/90 px-2 py-1 rounded text-xs">
              📍 Your photo location
            </div>
          </div>

          {loadingNearby ? (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Loading crags...
            </div>
          ) : hasArea ? (
            <div className="mt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Select an existing crag:
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {nearbyCrags.map((crag) => (
                  <button
                    key={crag.id}
                    onClick={() => handleSelectFromDropdown(crag)}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      selectedCragId === crag.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{crag.name}</div>
                    {crag.rock_type && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{crag.rock_type}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No crags in this region - enter a name to create one!
            </div>
          )}
        </div>
      )}

      {showCreate ? (
        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={newCragName}
              onChange={(e) => {
                setNewCragName(e.target.value)
                checkTagValidity(e.target.value)
              }}
              placeholder="Enter crag name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {checkingTag && (
              <div className="mt-1 text-sm text-gray-500">Checking if crag exists nearby...</div>
            )}
            {existingMatch?.exists && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                  ⚠️ {existingMatch.message}
                </p>
                <button
                  onClick={handleUseExisting}
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Use existing &quot;{existingMatch.crag.name}&quot; instead
                </button>
              </div>
            )}
            {!existingMatch?.exists && tagChecked && !checkingTag && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <p className="text-sm text-green-700 dark:text-green-300">
                  ✓ New crag - drag the pin to adjust location if needed
                </p>
              </div>
            )}
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="h-48">
              <MapContainer
                center={[parseFloat(newCragLat) || (hasGps ? latitude : 49.45), parseFloat(newCragLng) || (hasGps ? longitude : -2.58)]}
                zoom={hasGps ? 14 : 12}
                style={{ height: '100%', width: '100%' }}
                dragging={true}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {leaflet && (
                  <>
                    {parseFloat(newCragLat) && parseFloat(newCragLng) && (
                      <Marker
                        position={[parseFloat(newCragLat), parseFloat(newCragLng)]}
                        icon={leaflet.divIcon({
                          className: 'crag-marker draggable',
                          iconSize: [24, 24],
                          iconAnchor: [12, 12]
                        })}
                        draggable={true}
                        eventHandlers={{
                          drag: handleMarkerDrag
                        }}
                      />
                    )}
                  </>
                )}
              </MapContainer>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Drag the pin to adjust location</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCragLat}
                  onChange={(e) => setNewCragLat(e.target.value)}
                  placeholder="Latitude"
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={newCragLng}
                  onChange={(e) => setNewCragLng(e.target.value)}
                  placeholder="Longitude"
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
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
              disabled={!newCragName.trim() || isCreating || checkingTag || existingMatch?.exists}
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
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleEnterPressed}
              placeholder="Search or enter crag name..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onFocus={() => {
                if (query.length >= 2) searchCrags(query)
              }}
            />

            {checkingTag && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            )}

            {existingMatch?.exists && !showCreate && (
              <div className="absolute z-10 w-full mt-1 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                  ⚠️ {existingMatch.message}
                </p>
                <button
                  onClick={handleUseExisting}
                  className="w-full py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  Use existing crag
                </button>
              </div>
            )}

            {!existingMatch?.exists && tagChecked && query.length >= 2 && !checkingTag && (
              <div className="absolute z-10 w-full mt-1 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Press Enter to create &quot;{query}&quot;
                </p>
              </div>
            )}

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
                    onClick={() => handleSelectFromDropdown(crag)}
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

            {query.length >= 2 && !loading && results.length === 0 && !existingMatch?.exists && tagChecked && (
              <div className="absolute z-10 w-full mt-1 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg text-sm text-gray-500 dark:text-gray-400 text-center">
                No crags found - press Enter to create
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
        .crag-marker.draggable {
          cursor: grab;
          background: #10b981;
        }
        .crag-marker.draggable:active {
          cursor: grabbing;
        }
      `}</style>
    </div>
  )
}
