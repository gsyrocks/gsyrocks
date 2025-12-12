'use client'

import { useRef, useState, useEffect } from 'react'

interface RoutePoint {
  x: number
  y: number
}

interface RouteCanvasProps {
  imageUrl: string
  latitude: number
  longitude: number
  sessionId: string
}

export default function RouteCanvas({ imageUrl, latitude, longitude, sessionId }: RouteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [routes, setRoutes] = useState<RoutePoint[][]>([])
  const [currentRoute, setCurrentRoute] = useState<RoutePoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const handleImageLoad = () => {
      canvas.width = image.width
      canvas.height = image.height
      setImageLoaded(true)
      redraw()
    }

    if (image.complete) {
      handleImageLoad()
    } else {
      image.addEventListener('load', handleImageLoad)
    }

    return () => image.removeEventListener('load', handleImageLoad)
  }, [imageUrl])

  const redraw = () => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0)

    // Draw completed routes
    routes.forEach(route => {
      if (route.length > 1) {
        ctx.strokeStyle = 'red'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(route[0].x, route[0].y)
        for (let i = 1; i < route.length; i++) {
          ctx.lineTo(route[i].x, route[i].y)
        }
        ctx.stroke()
      }
    })

    // Draw current route
    if (currentRoute.length > 1) {
      ctx.strokeStyle = 'blue'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(currentRoute[0].x, currentRoute[0].y)
      for (let i = 1; i < currentRoute.length; i++) {
        ctx.lineTo(currentRoute[i].x, currentRoute[i].y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  useEffect(() => {
    if (imageLoaded) redraw()
  }, [routes, currentRoute, imageLoaded])

  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true)
    const pos = getMousePos(e)
    setCurrentRoute([pos])
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return
    const pos = getMousePos(e)
    setCurrentRoute(prev => [...prev, pos])
  }

  const handleMouseUp = () => {
    if (isDrawing && currentRoute.length > 1) {
      setRoutes(prev => [...prev, currentRoute])
    }
    setCurrentRoute([])
    setIsDrawing(false)
  }

  const handleFinishRoute = () => {
    if (currentRoute.length > 1) {
      setRoutes(prev => [...prev, currentRoute])
      setCurrentRoute([])
    }
  }

  const handleUndo = () => {
    if (routes.length > 0) {
      setRoutes(prev => prev.slice(0, -1))
    }
  }

  const handleSave = () => {
    // Save routes to localStorage for now, redirect to naming
    const routeData = {
      imageUrl,
      latitude,
      longitude,
      routes,
      sessionId
    }
    localStorage.setItem('routeSession', JSON.stringify(routeData))
    window.location.href = `/name-routes?sessionId=${sessionId}`
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-4">
        <img ref={imageRef} src={imageUrl} alt="Climbing route" className="max-w-full h-auto" />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
      <div className="flex gap-4 mb-4">
        <button onClick={handleFinishRoute} className="bg-green-500 text-white px-4 py-2 rounded">
          Finish Route
        </button>
        <button onClick={handleUndo} className="bg-yellow-500 text-white px-4 py-2 rounded">
          Undo Last Route
        </button>
      </div>
      <button onClick={handleSave} className="bg-blue-500 text-white px-6 py-3 rounded">
        Save & Continue to Naming
      </button>
      <p className="mt-2 text-sm text-gray-600">
        Routes drawn: {routes.length} | Current points: {currentRoute.length}
      </p>
    </div>
  )
}