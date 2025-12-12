import { createClient } from '@/lib/supabase'
import PendingClimbs from './components/PendingClimbs'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: pendingClimbs } = await supabase
    .from('climbs')
    .select(`
      *,
      crags (*),
      profiles:users (*)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin - Pending Approvals</h1>
      <PendingClimbs initialClimbs={pendingClimbs || []} />
    </div>
  )
}