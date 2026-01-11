import { NextRequest, NextResponse } from 'next/server'

interface CreateCragRequest {
  name: string
  region_id?: string
  region_name?: string
  rock_type?: string
  type?: 'sport' | 'boulder' | 'trad' | 'mixed'
  description?: string
  access_notes?: string
  boundary_vertices?: [number, number][]
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateCragRequest = await request.json()
    const { name, region_id, region_name, rock_type, type, description, access_notes, boundary_vertices } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    if (!boundary_vertices || boundary_vertices.length < 3) {
      return NextResponse.json(
        { error: 'A valid crag boundary (at least 3 points) is required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    let resolvedRegionId = region_id

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

    const checkNameResponse = await fetch(
      `${supabaseUrl}/rest/v1/crags?select=id,name&name=ilike.${encodeURIComponent(name)}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      }
    )

    if (checkNameResponse.ok) {
      const existingCrags = await checkNameResponse.json()
      if (existingCrags.length > 0) {
        return NextResponse.json(
          { 
            error: `A crag with this name already exists: "${existingCrags[0].name}"`,
            existingCragId: existingCrags[0].id,
            existingCragName: existingCrags[0].name,
            code: 'DUPLICATE_NAME'
          },
          { status: 409 }
        )
      }
    }

    const centerLat = boundary_vertices.reduce((sum, v) => sum + v[0], 0) / boundary_vertices.length
    const centerLng = boundary_vertices.reduce((sum, v) => sum + v[1], 0) / boundary_vertices.length

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
          latitude: centerLat,
          longitude: centerLng,
          region_id: resolvedRegionId || undefined,
          rock_type: rock_type || undefined,
          type: type || 'sport',
          description: description || undefined,
          access_notes: access_notes || undefined,
          boundary: `POLYGON((${boundary_vertices.map(v => `${v[1]} ${v[0]}`).join(', ')}))`
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
      latitude: centerLat,
      longitude: centerLng,
      region_id: resolvedRegionId || null,
      rock_type: rock_type || null,
      type: type || 'sport',
      boundary: boundary_vertices,
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
