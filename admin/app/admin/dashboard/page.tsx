'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Bell, Users, TrendingUp, Clock, CheckCircle, RefreshCw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  activeExams: number
  totalExams: number
  weekNotifs: number
  totalSubs: number
  closingSoon: number
  resultDeclared: number
}

const TYPE_COLORS: Record<string, string> = {
  new_job:    'bg-blue-100 text-blue-700',
  result:     'bg-green-100 text-green-700',
  admit_card: 'bg-orange-100 text-orange-700',
  answer_key: 'bg-purple-100 text-purple-700',
  syllabus:   'bg-teal-100 text-teal-700',
}
const TYPE_LABELS: Record<string, string> = {
  new_job: 'New Job', result: 'Result', admit_card: 'Admit Card',
  answer_key: 'Answer Key', syllabus: 'Syllabus',
}
const STATUS_COLORS: Record<string, string> = {
  upcoming:        'bg-blue-100 text-blue-700',
  active:          'bg-green-100 text-green-700',
  closed:          'bg-gray-100 text-gray-600',
  result_declared: 'bg-purple-100 text-purple-700',
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-24" />
        <div className="h-7 bg-gray-200 rounded w-16" />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const fetchAll = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const [
      activeExamsRes, totalExamsRes, weekNotifsRes,
      totalSubsRes, closingSoonRes, resultDeclaredRes,
      notifsRes, examsRes,
    ] = await Promise.all([
      // Active Exams: count 'active' AND 'upcoming' — both mean the exam is live
      supabase.from('exams')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'upcoming']),

      // Total exams
      supabase.from('exams')
        .select('id', { count: 'exact', head: true }),

      // Notifications posted in last 7 days
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .gte('published_at', oneWeekAgo),

      // Total subscribers
      supabase.from('subscriptions')
        .select('id', { count: 'exact', head: true }),

      // Closing in next 7 days (active or upcoming exams)
      supabase.from('exams')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'upcoming'])
        .lte('application_end', sevenDaysAhead)
        .gte('application_end', today),

      // Results declared
      supabase.from('exams')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'result_declared'),

      // Recent notifications (DISTINCT by id to prevent any join-based duplication)
      supabase.from('notifications')
        .select('id, title, type, published_at, exams(title)')
        .order('published_at', { ascending: false })
        .limit(6),

      // Recent exams
      supabase.from('exams')
        .select('id, title, status, application_end, categories(name)')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    setStats({
      activeExams:    activeExamsRes.count  ?? 0,
      totalExams:     totalExamsRes.count   ?? 0,
      weekNotifs:     weekNotifsRes.count   ?? 0,
      totalSubs:      totalSubsRes.count    ?? 0,
      closingSoon:    closingSoonRes.count  ?? 0,
      resultDeclared: resultDeclaredRes.count ?? 0,
    })

    // Deduplicate notifications by id just in case
    const seen = new Set<string>()
    const uniqueNotifs = (notifsRes.data ?? []).filter((n: any) => {
      if (seen.has(n.id)) return false
      seen.add(n.id)
      return true
    })
    setNotifications(uniqueNotifs)
    setExams(examsRes.data ?? [])
    setLastRefreshed(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  // Initial load
  useEffect(() => { fetchAll() }, [fetchAll])

  // Refetch on window focus (so numbers are always fresh)
  useEffect(() => {
    const onFocus = () => fetchAll(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchAll])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchAll(true), 60_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Supabase real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => fetchAll(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchAll(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => fetchAll(true))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  const cards = stats
    ? [
      { label: 'Live Exams (Active/Upcoming)', value: stats.activeExams,    icon: FileText,   color: 'bg-blue-500',   light: 'bg-blue-50' },
      { label: 'Notifications (7d)',           value: stats.weekNotifs,     icon: Bell,       color: 'bg-orange-500', light: 'bg-orange-50' },
      { label: 'Total Subscribers',            value: stats.totalSubs,      icon: Users,      color: 'bg-green-500',  light: 'bg-green-50' },
      { label: 'Closing Soon (7d)',            value: stats.closingSoon,    icon: Clock,      color: 'bg-red-500',    light: 'bg-red-50' },
      { label: 'Total Exams',                  value: stats.totalExams,     icon: TrendingUp, color: 'bg-[#1A3C6E]',  light: 'bg-[#EEF2F8]' },
      { label: 'Results Declared',             value: stats.resultDeclared, icon: CheckCircle,color: 'bg-purple-500', light: 'bg-purple-50' },
    ]
    : []

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[#0F1C30] font-bold text-xl sm:text-2xl">Dashboard</h1>
          <p className="text-[#5B6880] text-xs sm:text-sm mt-1">
            Overview of JobAlert —{' '}
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs font-semibold text-[#5B6880] hover:text-[#1A3C6E] border border-gray-200 bg-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50 shadow-xs"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : `Refreshed ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
        {loading
          ? [1, 2, 3, 4, 5, 6].map(i => <StatSkeleton key={i} />)
          : cards.map(({ label, value, icon: Icon, color, light }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-4">
              <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${light} flex items-center justify-center flex-shrink-0`}>
                <Icon size={22} className={color.replace('bg-', 'text-')} />
              </div>
              <div>
                <p className="text-[#5B6880] text-xs font-medium">{label}</p>
                <p className="text-[#0F1C30] font-bold text-xl sm:text-2xl mt-0.5">{value.toLocaleString('en-IN')}</p>
              </div>
            </div>
          ))
        }
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Notifications */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h2 className="font-bold text-[#0F1C30] text-sm">Recent Notifications</h2>
            <a href="/admin/notifications" className="text-[#FF7A00] text-xs font-semibold hover:underline">View all →</a>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="px-6 py-4 flex gap-3 animate-pulse">
                  <div className="h-5 w-20 bg-gray-100 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-50 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : notifications.length === 0 ? (
              <p className="text-[#5B6880] text-sm text-center py-8">No notifications yet.</p>
            ) : (
              notifications.map((n: any) => (
                <div key={n.id} className="px-6 py-3.5 flex items-start gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_LABELS[n.type] ?? n.type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[#0F1C30] text-sm font-medium truncate">{n.title}</p>
                    <p className="text-[#5B6880] text-xs mt-0.5">
                      {n.exams?.title ?? '—'} · {new Date(n.published_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Exams */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h2 className="font-bold text-[#0F1C30] text-sm">Recent Exams</h2>
            <a href="/admin/exams" className="text-[#FF7A00] text-xs font-semibold hover:underline">View all →</a>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="px-6 py-4 flex justify-between gap-3 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-50 rounded w-1/2" />
                  </div>
                  <div className="h-5 w-16 bg-gray-100 rounded-full" />
                </div>
              ))
            ) : exams.length === 0 ? (
              <p className="text-[#5B6880] text-sm text-center py-8">No exams yet.</p>
            ) : (
              exams.map((e: any) => (
                <div key={e.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[#0F1C30] text-sm font-medium truncate">{e.title}</p>
                    <p className="text-[#5B6880] text-xs mt-0.5">
                      {e.categories?.name ?? 'Uncategorised'}
                      {e.application_end ? ` · Closes ${e.application_end}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[e.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {e.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
