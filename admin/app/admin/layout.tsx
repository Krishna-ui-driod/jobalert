export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  // Auth check — middleware handles redirect, this is a secondary guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // NOTE: We do NOT query the admins table here because the anon-key server client
  // cannot read it (RLS: "admins: admin read" requires is_admin() to be true first).
  // Security is enforced by:
  //   1. Supabase Auth (user must be logged in)
  //   2. RLS policies on every table (only admins can INSERT/UPDATE/DELETE)
  //   3. The middleware which blocks unauthenticated requests

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F4F5F7]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto w-full min-w-0">
        {children}
      </main>
    </div>
  )
}
