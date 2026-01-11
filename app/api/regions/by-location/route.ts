import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Direct SQL query to find nearest region
    const response = await fetch(
      `${supabaseUrl}/rest/v1/regions?select=id,name,country_code,center_lat,center_lon&center_lat=not.is.null&center_lon=not.is.null&order=center_lat.asc.nullsfirst&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch regions' },
        { status: 500 }
      )
    }

    const regions = await response.json()

    if (!regions || regions.length === 0) {
      return NextResponse.json(
        { error: 'No regions found' },
        { status: 404 }
      )
    }

    // Find nearest region
    let nearestRegion = null
    let minDistance = Infinity

    for (const region of regions) {
      if (region.center_lat && region.center_lon) {
        const distance = Math.sqrt(
          Math.pow((region.center_lat - latitude) * 111320, 2) +
          Math.pow((region.center_lon - longitude) * 111320 * Math.cos(latitude * Math.PI / 180), 2)
        )
        if (distance < minDistance) {
          minDistance = distance
          nearestRegion = region
        }
      }
    }

    if (!nearestRegion) {
      return NextResponse.json(
        { error: 'No region found for this location' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: nearestRegion.id,
      name: nearestRegion.name,
      country_code: nearestRegion.country_code,
      center_lat: nearestRegion.center_lat,
      center_lon: nearestRegion.center_lon
    })
  } catch (error) {
    console.error('Error finding region:', error)
    return NextResponse.json(
      { error: 'Failed to find region' },
      { status: 500 }
    )
  }
}
