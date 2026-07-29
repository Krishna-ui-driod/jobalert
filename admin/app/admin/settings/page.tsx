export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { Shield, Database, Globe } from 'lucide-react'

export const metadata = { title: 'Settings — JobAlert Admin' }

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[#0F1C30] font-bold text-2xl">Settings</h1>
        <p className="text-[#5B6880] text-sm mt-1">Account info and project configuration.</p>
      </div>

      <div className="space-y-5">
        {/* Account */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0F1C30] text-sm flex items-center gap-2 mb-5">
            <Shield size={15} className="text-[#FF7A00]" /> Your Account
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm text-[#5B6880] font-medium">Email</span>
              <span className="text-sm text-[#0F1C30] font-semibold">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm text-[#5B6880] font-medium">User ID</span>
              <span className="text-xs text-[#5B6880] font-mono">{user?.id?.slice(0, 18)}…</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-[#5B6880] font-medium">Role</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                SUPER ADMIN
              </span>
            </div>
          </div>
        </div>

        {/* Supabase config */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0F1C30] text-sm flex items-center gap-2 mb-5">
            <Database size={15} className="text-[#FF7A00]" /> Supabase Configuration
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 border-b border-gray-50">
              <span className="text-sm text-[#5B6880] font-medium">Project URL</span>
              <span className="text-sm text-[#0F1C30] font-mono truncate max-w-xs text-xs">
                {process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? 'Not configured'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-[#5B6880] font-medium">Anon Key</span>
              <span className="text-sm text-[#0F1C30] font-mono">
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing'}
              </span>
            </div>
          </div>
          <div className="mt-4 bg-[#EEF2F8] rounded-lg px-4 py-3 text-xs text-[#5B6880]">
            💡 Update credentials in <code className="font-mono bg-white px-1 rounded">.env.local</code> and restart the server.
          </div>
        </div>

        {/* Links */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0F1C30] text-sm flex items-center gap-2 mb-5">
            <Globe size={15} className="text-[#FF7A00]" /> Quick Links
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Supabase Dashboard', href: 'https://supabase.com/dashboard' },
              { label: 'Homepage (Dev)',      href: 'http://localhost:5173' },
              { label: 'Supabase Docs',      href: 'https://supabase.com/docs' },
              { label: 'Next.js Docs',       href: 'https://nextjs.org/docs' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#1A3C6E] font-medium hover:text-[#FF7A00] hover:underline transition-colors"
              >
                ↗ {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
