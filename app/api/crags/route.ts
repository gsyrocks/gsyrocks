import { NextRequest, NextResponse } from 'next/server'

interface CreateCragRequest {
  name: string
  region_id?: string
  region_name?: string
  rock_type?: string
  type?: 'sport' | 'boulder' | 'trad' | 'mixed'
  description?: string
  access_notes?: string
  latitude: number
  longitude: number
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateCragRequest = await request.json()
    const { name, region_id, region_name, rock_type, type, description, access_notes, latitude, longitude } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'GPS coordinates are required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    let resolvedRegionId = region_id

    // Resolve region by name if needed
    if (!resolvedRegionId && region_name) {
      const regionSearchResponse = await fetch(
        `${supabaseUrl}/rest/v1/regions?select=id,name&name=ilike.${encodeURIComponent(region_name)}&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
        }
      )

      if (regionSearchResponse.ok) {
        const regions = await regionSearchResponse.json()
        if (regions.length > 0) {
          resolvedRegionId = regions[0].id
        } else {
          const createRegionResponse = await fetch(
            `${supabaseUrl}/rest/v1/regions`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({ name: region_name }),
            }
          )
          if (createRegionResponse.ok) {
            resolvedRegionId = createRegionResponse.headers.get('location')?.split('/').pop() || undefined
          }
        }
      }
    }

    // Check for nearby crag with same name (within 200m)
    const checkNearbyResponse = await fetch(
      `${supabaseUrl}/rest/v1/crags?select=id,name,latitude,longitude&name=ilike.${encodeURIComponent(name)}&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      }
    )

    if (checkNearbyResponse.ok) {
      const nearbyCrags = await checkNearbyResponse.json()
      for (const crag of nearbyCrags) {
        const distance = Math.sqrt(
          Math.pow((crag.latitude - latitude) * 111320, 2) +
          Math.pow((crag.longitude - longitude) * 111320 * Math.cos(latitude * Math.PI / 180), 2)
        )
        if (distance < 200 && resolvedRegionId === crag.region_id) {
          return NextResponse.json(
            {
              error: `A crag with this name already exists nearby (${Math.round(distance)}m): "${crag.name}"`,
              existingCragId: crag.id,
              existingCragName: crag.name,
              distanceMeters: Math.round(distance),
              code: 'DUPLICATE_NEARBY'
            },
            { status: 409 }
          )
        }
      }
    }

    // Create 5m circle polygon around point using PostGIS
    const polygonWKT = `POLYGON((${
      Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 8) * 2 * Math.PI
        const dx = 5 * Math.cos(angle) / 111320 / Math.cos(latitude * Math.PI / 180)
        const dy = 5 * Math.sin(angle) / 111320
        return `${longitude + dx} ${latitude + dy}`
      }).join(', ')
    }, ${longitude} ${latitude}))`

    const response = await fetch(
      `${supabaseUrl}/rest/v1/crags`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          name,
          latitude,
          longitude,
          region_id: resolvedRegionId || undefined,
          rock_type: rock_type || undefined,
          type: type || 'sport',
          description: description || undefined,
          access_notes: access_notes || undefined,
          boundary: polygonWKT
        }),
      }
    )

    const errorText = await response.text()

    if (!response.ok) {
      let errorMessage = 'Failed to create crag'
      let errorCode = ''

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message) {
          errorMessage = errorJson.message
        } else if (errorJson.error) {
          errorMessage = errorJson.error
        }
        if (errorJson.code) {
          errorCode = errorJson.code
        }
      } catch {
        errorMessage = `Server error: ${errorText.substring(0, 100)}`
      }

      return NextResponse.json(
        { error: errorMessage, code: errorCode },
        { status: response.status }
      )
    }

    const createdCragId = response.headers.get('location')?.split('/').pop()

    const createdCrag = {
      id: createdCragId,
      name,
      latitude,
      longitude,
      region_id: resolvedRegionId || null,
      rock_type: rock_type || null,
      type: type || 'sport',
      radius_meters: 5,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json(createdCrag, { status: 201 })
  } catch (error) {
    console.error('Error creating crag:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create crag' },
      { status: 500 }
    )
  }
}
