'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Polygon = dynamic(() => import('react-leaflet').then(mod => mod.Polygon), { ssr: false })

const DEFAULT_LAT = 49.45
const DEFAULT_LNG = -2.58
const DEFAULT_ZOOM = 14

interface CragAreaEditorProps {
  initialLat: number | null
  initialLng: number | null
  initialVertices?: [number, number][]
  onSave: (vertices: [number, number][], centerLat: number, centerLng: number) => void
  onClose: () => void
}

interface VertexMarker {
  id: string
  lat: number
  lng: number
}

export default function CragAreaEditor({
  initialLat,
  initialLng,
  initialVertices = [],
  onSave,
  onClose
}: CragAreaEditorProps) {
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null)
  const [vertices, setVertices] = useState<VertexMarker[]>(
    initialVertices.map((v, i) => ({
      id: `vertex-${i}`,
      lat: v[0],
      lng: v[1]
    }))
  )
  const [draggingVertexId, setDraggingVertexId] = useState<string | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [vertexBeingAdded, setVertexBeingAdded] = useState(false)

  useEffect(() => {
    import('leaflet').then(L => {
      setLeaflet(L)
    })
  }, [])

  const centerLat = initialLat ?? DEFAULT_LAT
  const centerLng = initialLng ?? DEFAULT_LNG

  const getPolygonPositions = useCallback(() => {
    if (vertices.length < 3) return []
    return vertices.map(v => [v.lat, v.lng] as [number, number])
  }, [vertices])

  const getPolygonPath = useCallback(() => {
    if (vertices.length < 3) return []
    return vertices.map(v => [v.lat, v.lng])
  }, [vertices])

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    if (!leaflet) return

    if (vertexBeingAdded) {
      const newVertex: VertexMarker = {
        id: `vertex-${Date.now()}`,
        lat: e.latlng.lat,
        lng: e.latlng.lng
      }
      setVertices(prev => [...prev, newVertex])
    }
  }, [leaflet, vertexBeingAdded])

  const handleMarkerDrag = useCallback((vertexId: string, e: L.LeafletEvent) => {
    if (!leaflet) return
    const marker = e.target as L.Marker
    const position = marker.getLatLng()
    
    setVertices(prev => prev.map(v => 
      v.id === vertexId 
        ? { ...v, lat: position.lat, lng: position.lng }
        : v
    ))
  }, [leaflet])

  const handleSave = () => {
    if (vertices.length < 3) return

    const vertexArray = vertices.map(v => [v.lat, v.lng] as [number, number])
    const centerLat = vertices.reduce((sum, v) => sum + v.lat, 0) / vertices.length
    const centerLng = vertices.reduce((sum, v) => sum + v.lng, 0) / vertices.length

    onSave(vertexArray, centerLat, centerLng)
  }

  const handleDeleteVertex = (vertexId: string) => {
    setVertices(prev => prev.filter(v => v.id !== vertexId))
  }

  const handleClosePolygon = () => {
    if (vertices.length >= 3) {
      setVertexBeingAdded(false)
    }
  }

  const handleClear = () => {
    setVertices([])
    setVertexBeingAdded(false)
  }

  const handleStartDrawing = () => {
    setVertexBeingAdded(true)
  }

  useEffect(() => {
    if (mapInstance && leaflet) {
      const handleClick = (e: L.LeafletMouseEvent) => {
        handleMapClick(e)
      }
      mapInstance.on('click', handleClick)
      return () => {
        mapInstance.off('click', handleClick)
      }
    }
  }, [mapInstance, leaflet, handleMapClick])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Draw Crag Area</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Click on the map to place vertices. Drag vertices to adjust. Close the polygon when done.
          </p>
        </div>

        <div className="relative h-96">
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
            dragging={true}
            zoomControl={true}
            ref={(ref: any) => setMapInstance(ref)}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {leaflet && vertices.length >= 3 && (
              <Polygon
                positions={getPolygonPath()}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.2,
                  weight: 2
                }}
              />
            )}

            {leaflet && vertices.map((vertex) => (
              <Marker
                key={vertex.id}
                position={[vertex.lat, vertex.lng]}
                icon={leaflet.divIcon({
                  className: 'vertex-marker',
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}
                draggable={true}
                eventHandlers={{
                  drag: (e) => handleMarkerDrag(vertex.id, e),
                  contextmenu: () => handleDeleteVertex(vertex.id)
                }}
              />
            ))}

            {leaflet && initialLat && initialLng && vertices.length === 0 && (
              <Marker
                position={[initialLat, initialLng]}
                icon={leaflet.divIcon({
                  className: 'center-marker',
                  iconSize: [12, 12],
                  iconAnchor: [6, 6]
                })}
              />
            )}

            {vertexBeingAdded && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-full text-sm">
                Click map to add vertices
              </div>
            )}
          </MapContainer>

          {vertices.length > 0 && vertices.length < 3 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-amber-600 text-white px-4 py-2 rounded-full text-sm">
              Need {3 - vertices.length} more vertex{vertices.length === 2 ? '' : 'es'} to close polygon
            </div>
          )}
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {vertices.length} vertex{vertices.length !== 1 ? 'es' : ''} placed
              {vertices.length >= 3 && ' • Polygon ready'}
            </div>
            <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Drag to move</span>
              <span>•</span>
              <span>Right-click to delete</span>
            </div>
          </div>
        </div>

        <div className="p-4 flex gap-3 flex-wrap">
          {!vertexBeingAdded && vertices.length === 0 && (
            <button
              onClick={handleStartDrawing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Drawing
            </button>
          )}

          {vertexBeingAdded && vertices.length < 20 && (
            <button
              onClick={() => setVertexBeingAdded(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Stop Adding
            </button>
          )}

          {vertices.length > 0 && vertices.length < 3 && (
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Clear All
            </button>
          )}

          {vertexBeingAdded && vertices.length >= 3 && (
            <button
              onClick={handleClosePolygon}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Close Polygon
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={vertices.length < 3}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Area
          </button>
        </div>
      </div>

      <style jsx global>{`
        .vertex-marker {
          background: #3b82f6;
          border: 2px solid white;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .vertex-marker:active {
          cursor: grabbing;
        }
        .center-marker {
          background: #ef4444;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  )
}
