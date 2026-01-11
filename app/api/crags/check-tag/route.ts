import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

interface CheckTagRequest {
  name: string
  region_id: string
  latitude: number
  longitude: number
}

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
  const name = searchParams.get('name')
  const regionId = searchParams.get('region_id')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!name || !regionId || !lat || !lng) {
    return NextResponse.json(
      { error: 'name, region_id, lat, and lng parameters are required' },
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
    // Search for crags with same name in same region
    const { data: crags, error } = await supabase
      .from('crags')
      .select('id, name, latitude, longitude, boundary, rock_type, type, radius_meters')
      .ilike('name', name)
      .eq('region_id', regionId)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to check tag' },
        { status: 500 }
      )
    }

    if (!crags || crags.length === 0) {
      return NextResponse.json({ exists: false })
    }

    // Check each crag
    for (const crag of crags) {
      // First check distance
      const distance = Math.sqrt(
        Math.pow((crag.latitude - latitude) * 111320, 2) +
        Math.pow((crag.longitude - longitude) * 111320 * Math.cos(latitude * Math.PI / 180), 2)
      )

      // If within 200m, consider it a match
      if (distance < 200) {
        return NextResponse.json({
          exists: true,
          crag: {
            id: crag.id,
            name: crag.name,
            latitude: crag.latitude,
            longitude: crag.longitude,
            rock_type: crag.rock_type,
            type: crag.type,
            radius_meters: crag.radius_meters,
            distanceMeters: Math.round(distance)
          },
          message: `Crag "${crag.name}" exists ${Math.round(distance)}m away`
        })
      }
    }

    // No nearby crag found
    return NextResponse.json({ exists: false })
  } catch (error) {
    console.error('Error checking tag:', error)
    return NextResponse.json(
      { error: 'Failed to check tag' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckTagRequest = await request.json()
    const { name, region_id, latitude, longitude } = body

    if (!name || !region_id || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'name, region_id, latitude, and longitude are required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Search for crags with same name in same region
    const searchResponse = await fetch(
      `${supabaseUrl}/rest/v1/crags?select=id,name,latitude,longitude,boundary,rock_type,type,radius_meters&name=ilike.${encodeURIComponent(name)}&region_id=eq.${region_id}`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      }
    )

    if (!searchResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to check tag' },
        { status: 500 }
      )
    }

    const crags = await searchResponse.json()

    if (!crags || crags.length === 0) {
      return NextResponse.json({ exists: false })
    }

    // Check each crag
    for (const crag of crags) {
      // Calculate distance
      const distance = Math.sqrt(
        Math.pow((crag.latitude - latitude) * 111320, 2) +
        Math.pow((crag.longitude - longitude) * 111320 * Math.cos(latitude * Math.PI / 180), 2)
      )

      // If within 200m, consider it a match
      if (distance < 200) {
        return NextResponse.json({
          exists: true,
          crag: {
            id: crag.id,
            name: crag.name,
            latitude: crag.latitude,
            longitude: crag.longitude,
            rock_type: crag.rock_type,
            type: crag.type,
            radius_meters: crag.radius_meters,
            distanceMeters: Math.round(distance)
          },
          message: `Crag "${crag.name}" exists ${Math.round(distance)}m away`
        })
      }
    }

    return NextResponse.json({ exists: false })
  } catch (error) {
    console.error('Error checking tag:', error)
    return NextResponse.json(
      { error: 'Failed to check tag' },
      { status: 500 }
    )
  }
}
