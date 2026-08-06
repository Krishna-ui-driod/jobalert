'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileText, Bell, Users, Settings, LogOut, ChevronRight, Plus, Menu, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AddContentModal from './AddContentModal'

const NAV = [
  { href: '/admin/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/admin/exams',       label: 'Listings',    icon: FileText },
  { href: '/admin/subscribers', label: 'Subscribers', icon: Users },
  { href: '/admin/settings',    label: 'Settings',    icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1A3C6E] text-white border-b border-white/10 sticky top-0 z-30 w-full">
        <div className="flex items-center gap-2.5">
          <div className="bg-white rounded-lg px-1.5 py-0.5 shadow-sm">
            <img src="/logo.svg" alt="JobAlert" className="h-6 w-auto" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">
              Job<span className="text-[#FF7A00]">Alert</span>
            </p>
            <p className="text-white/50 text-[9px] uppercase tracking-wider mt-0.5">Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FF7A00] hover:bg-[#E86E00] text-white shadow-sm"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add</span>
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#1A3C6E] flex flex-col flex-shrink-0 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
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
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-white/60 hover:text-white p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Add New button */}
        <div className="px-3 pt-5 pb-2">
          <button
            onClick={() => {
              setAddModalOpen(true)
              setMobileOpen(false)
            }}
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
                onClick={() => setMobileOpen(false)}
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
            onClick={() => {
              setMobileOpen(false)
              handleSignOut()
            }}
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
