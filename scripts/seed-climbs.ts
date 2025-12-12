import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import exifr from 'exifr'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function uploadImage(filePath: string, fileName: string) {
  const fileBuffer = fs.readFileSync(filePath)
  const file = new File([fileBuffer], fileName, { type: 'image/jpeg' })

  // Extract GPS
  const gpsData = await exifr.parse(fileBuffer)
  if (!gpsData?.latitude || !gpsData?.longitude) {
    console.log(`No GPS data for ${fileName}, skipping`)
    return null
  }

  const filePathInStorage = `seed/${fileName}`

  // Check if file already exists
  const { data: existingFiles } = await supabase.storage
    .from('route-uploads')
    .list('seed', { search: fileName })

  let publicUrl: string

  if (existingFiles && existingFiles.length > 0) {
    // File exists, get public URL
    const { data: { publicUrl: existingUrl } } = supabase.storage
      .from('route-uploads')
      .getPublicUrl(filePathInStorage)
    publicUrl = existingUrl
    console.log(`File ${fileName} already exists, using existing URL`)
  } else {
    // Upload new file
    const { data, error } = await supabase.storage
      .from('route-uploads')
      .upload(filePathInStorage, file)

    if (error) {
      console.error(`Upload error for ${fileName}:`, error)
      return null
    }

    const { data: { publicUrl: newUrl } } = supabase.storage
      .from('route-uploads')
      .getPublicUrl(data.path)
    publicUrl = newUrl
  }

  return {
    imageUrl: publicUrl,
    latitude: gpsData.latitude,
    longitude: gpsData.longitude,
    fileName
  }
}

async function seedClimbs() {
  const uploadsDir = path.join(process.cwd(), 'gsyrocks', 'uploads')
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.jpg'))

  console.log(`Found ${files.length} JPG files to process`)

  for (const file of files) {
    const filePath = path.join(uploadsDir, file)
    const data = await uploadImage(filePath, file)

    if (!data) continue

    // Create or find crag
    let { data: crag } = await supabase
      .from('crags')
      .select('id')
      .eq('latitude', data.latitude)
      .eq('longitude', data.longitude)
      .single()

    if (!crag) {
      const { data: newCrag, error } = await supabase
        .from('crags')
        .insert({
          latitude: data.latitude,
          longitude: data.longitude,
          name: `Crag near Guernsey (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})`
        })
        .select('id')
        .single()

      if (error) {
        console.error('Crag creation error:', error)
        continue
      }
      crag = newCrag
    }

    // Create climb
    const climbName = file.replace('.jpg', '').replace(/ least$/, '').replace(/ /g, ' ')
    const { error } = await supabase
      .from('climbs')
      .insert({
        crag_id: crag.id,
        name: climbName,
        grade: 'V0', // Default grade
        description: `Auto-imported climb from ${file}`,
        coordinates: [], // Empty for now
        image_url: data.imageUrl,
        status: 'approved', // Auto-approve seed data
        created_by: null // System import
      })

    if (error) {
      console.error(`Climb creation error for ${file}:`, error)
    } else {
      console.log(`Created climb: ${climbName}`)
    }
  }

  console.log('Seeding complete!')
}

// Run the seeder
seedClimbs().catch(console.error)