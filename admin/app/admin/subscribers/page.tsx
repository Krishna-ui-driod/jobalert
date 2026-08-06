export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { Users, Mail, Bell } from 'lucide-react'

export const metadata = { title: 'Subscribers — JobAlert Admin' }

async function getSubscribers() {
  const supabase = createClient()
  const { data, count } = await supabase
    .from('subscriptions')
    .select('*, categories(name), exams(title)', { count: 'exact' })
    .order('id', { ascending: false })
  return { data: data ?? [], count: count ?? 0 }
}

async function getAlertBreakdown() {
  const supabase = createClient()
  const [email, push] = await Promise.all([
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('alert_type', 'email'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('alert_type', 'push'),
  ])
  return { email: email.count ?? 0, push: push.count ?? 0 }
}

export default async function SubscribersPage() {
  const [{ data: subscribers, count }, breakdown] = await Promise.all([
    getSubscribers(),
    getAlertBreakdown(),
  ])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-[#0F1C30] font-bold text-xl sm:text-2xl">Subscribers</h1>
        <p className="text-[#5B6880] text-xs sm:text-sm mt-1">Users subscribed to exam and notification alerts.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Subscribers', value: count, icon: Users, color: 'text-[#1A3C6E]', bg: 'bg-[#EEF2F8]' },
          { label: 'Email Alerts',      value: breakdown.email, icon: Mail,  color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Push Alerts',       value: breakdown.push,  icon: Bell,  color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-4">
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-[#5B6880] text-xs font-medium">{label}</p>
              <p className="text-[#0F1C30] font-bold text-xl sm:text-2xl">{value.toLocaleString('en-IN')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="font-bold text-[#0F1C30] text-sm">Subscription Details</h2>
        </div>
        {subscribers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Users size={32} className="text-gray-200" />
            <p className="text-[#5B6880] text-sm">No subscribers yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#EEF2F8] border-b border-gray-100">
                  {['User ID', 'Category', 'Exam', 'Alert Type'].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subscribers.map((s: any, i: number) => (
                  <tr key={s.id} className={i % 2 ? 'bg-[#FAFBFD]' : ''}>
                    <td className="px-5 py-3.5 text-xs text-[#5B6880] font-mono">{s.user_id.slice(0, 8)}…</td>
                    <td className="px-5 py-3.5 text-sm text-[#0F1C30]">{s.categories?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-[#0F1C30]">{s.exams?.title ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        s.alert_type === 'email'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {s.alert_type === 'email' ? <Mail size={10} /> : <Bell size={10} />}
                        {s.alert_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
