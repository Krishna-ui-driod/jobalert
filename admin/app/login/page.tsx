'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log('Attempting login with Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('Auth result:', { data, authError })

    if (authError) {
      console.error('Auth error:', authError)
      setError(`Login failed: ${authError.message}`)
      setLoading(false)
      return
    }

    if (!data.session) {
      setError('No session returned — check your Supabase credentials in .env.local')
      setLoading(false)
      return
    }

    // Full page reload so middleware picks up the fresh session cookie
    window.location.href = '/admin/dashboard'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A3C6E] via-[#1E4780] to-[#0F2448] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 px-5 py-3 rounded-2xl mb-6">
            <div className="bg-white rounded-xl px-2 py-1">
              <img src="/logo.svg" alt="JobAlert" className="h-9 w-auto" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-xl">
                Job<span className="text-[#FF7A00]">Alert</span>
              </p>
              <p className="text-white/50 text-[10px] uppercase tracking-widest">Admin Panel</p>
            </div>
          </div>
          <h1 className="text-white font-bold text-2xl">Sign in to continue</h1>
          <p className="text-white/50 text-sm mt-1">Manage exams, notifications &amp; more</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
                <span className="text-red-500 mt-0.5">⚠</span>
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#0F1C30] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@jobalert.in"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/10 transition-all placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F1C30] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/10 transition-all placeholder-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A3C6E] hover:bg-[#122C52] text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 mt-1"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          © {new Date().getFullYear()} JobAlert. Admin access only.
        </p>
      </div>
    </div>
  )
}
