'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Notification, NotificationType } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Bell, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'

export default function NotificationsPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchNotifications = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*, exams(title)')
      .order('published_at', { ascending: false })
    setNotifications(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchNotifications() }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    await supabase.from('notifications').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleteLoading(false)
    fetchNotifications()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[#0F1C30] font-bold text-2xl">Notifications</h1>
        <p className="text-[#5B6880] text-sm mt-1">
          All posted notifications — use the <span className="text-[#FF7A00] font-semibold">＋ Add New</span> button in the sidebar to post new ones.
        </p>
      </div>

      {/* Full-width notifications list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-[#0F1C30] text-sm">
            All Notifications
            <span className="ml-2 text-[#5B6880] font-normal text-xs">({notifications.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#5B6880] text-sm">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Bell size={32} className="text-gray-200" />
            <p className="text-[#5B6880] text-sm">No notifications posted yet.</p>
            <p className="text-[#5B6880] text-xs">Click <span className="text-[#FF7A00] font-semibold">＋ Add New</span> in the sidebar to post one.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <div key={n.id} className="px-6 py-4 flex items-start gap-4 group hover:bg-[#FFF7F0] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge type={n.type as NotificationType} />
                  </div>
                  <p className="text-[#0F1C30] text-sm font-semibold">{n.title}</p>
                  <p className="text-[#5B6880] text-xs mt-0.5">
                    {(n as any).exams?.title ?? 'No exam linked'} ·{' '}
                    {new Date(n.published_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  {n.pdf_url && (
                    <a href={n.pdf_url} target="_blank" rel="noopener noreferrer"
                      className="text-[#FF7A00] text-xs hover:underline mt-1 inline-block">
                      📄 View PDF
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setDeleteId(n.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Notification">
        <p className="text-[#5B6880] text-sm mb-6">Are you sure you want to delete this notification? This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
