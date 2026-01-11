import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const cookies = request.cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookies.getAll() },
        setAll() {},
      },
    }
  )

  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const radiusKm = parseFloat(searchParams.get('radius_km') || '10')

  if (!lat || !lng) {
    return NextResponse.json(
      { error: 'lat and lng parameters are required' },
      { status: 400 }
    )
  }

  const latitude = parseFloat(lat)
  const longitude = parseFloat(lng)

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json(
      { error: 'Invalid lat or lng values' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabase.rpc('find_crags_near_location', {
      search_lat: latitude,
      search_lng: longitude,
      radius_km: radiusKm
    })

    if (error) {
      console.error('Supabase RPC error:', error)
      return NextResponse.json(
        { error: 'Failed to find nearby crags' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error finding nearby crags:', error)
    return NextResponse.json(
      { error: 'Failed to find nearby crags' },
      { status: 500 }
    )
  }
}
