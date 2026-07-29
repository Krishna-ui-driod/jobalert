'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Bell, Users, Settings, LogOut, ChevronRight, Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AddContentModal from './AddContentModal'

const NAV = [
  { href: '/admin/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/exams',          label: 'Exams',          icon: FileText },
  { href: '/admin/notifications',  label: 'Notifications',  icon: Bell },
  { href: '/admin/subscribers',    label: 'Subscribers',    icon: Users },
  { href: '/admin/settings',       label: 'Settings',       icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [addModalOpen, setAddModalOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleAddSuccess = () => {
    // Refresh the current page to show new data
    router.refresh()
    // Also do a full page reload for client components
    window.location.reload()
  }

  return (
    <>
      <aside className="w-64 min-h-screen bg-[#1A3C6E] flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="bg-white rounded-xl px-2 py-1 shadow-sm">
            <img src="/logo.svg" alt="JobAlert" className="h-8 w-auto" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">
              Job<span className="text-[#FF7A00]">Alert</span>
            </p>
            <p className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">Admin Panel</p>
          </div>
        </div>

        {/* Add New button */}
        <div className="px-3 pt-5 pb-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#FF7A00] hover:bg-[#E86E00] text-white shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={17} strokeWidth={2.5} />
            Add New
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/65 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={17} />
                <span>{label}</span>
                {active && <ChevronRight size={13} className="ml-auto opacity-70" />}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-5 border-t border-white/10 pt-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Unified Add Content Modal */}
      <AddContentModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </>
  )
}
