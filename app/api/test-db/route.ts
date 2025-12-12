import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error, count } = await supabase
      .from('climbs')
      .select(`
        id, name, status,
        crags (name, latitude, longitude)
      `, { count: 'exact' })
      .eq('status', 'approved')

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    return NextResponse.json({
      count,
      climbs: data?.slice(0, 3) || [], // Show first 3 climbs
      total: data?.length || 0
    })
  } catch (err) {
    return NextResponse.json({ error: 'Connection failed', details: err }, { status: 500 })
  }
}