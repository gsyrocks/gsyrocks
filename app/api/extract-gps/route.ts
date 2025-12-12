import { NextRequest, NextResponse } from 'next/server'
import exifr from 'exifr'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const exifData = await exifr.parse(buffer)

    if (!exifData?.latitude || !exifData?.longitude) {
      return NextResponse.json({ error: 'No GPS data found in image' }, { status: 400 })
    }

    return NextResponse.json({
      latitude: exifData.latitude,
      longitude: exifData.longitude,
      altitude: exifData.altitude
    })
  } catch (error) {
    console.error('GPS extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract GPS data' }, { status: 500 })
  }
}