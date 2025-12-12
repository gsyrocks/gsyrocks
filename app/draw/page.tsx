import RouteCanvas from './components/RouteCanvas'

interface DrawPageProps {
  searchParams: {
    imageUrl: string
    lat: string
    lng: string
    sessionId: string
  }
}

export default function DrawPage({ searchParams }: DrawPageProps) {
  const { imageUrl, lat, lng, sessionId } = searchParams

  if (!imageUrl) {
    return <div>Invalid session. Please start from upload.</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Draw Climbing Routes</h1>
      <p className="mb-6">Click and drag on the image to draw route lines. Multiple routes allowed.</p>
      <RouteCanvas imageUrl={imageUrl} latitude={parseFloat(lat)} longitude={parseFloat(lng)} sessionId={sessionId} />
    </div>
  )
}