'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Notification } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ExamForm from './ExamForm'
import { Search, Pencil, Trash2, RefreshCw, FileText, Bell, Download } from 'lucide-react'

export interface UnifiedListing {
  id: string
  source: 'exam' | 'notification'
  contentType: string // 'exam' | 'result' | 'admit_card' | 'answer_key' | 'syllabus' | 'new_job'
  typeLabel: string
  title: string
  subtitle?: string
  dateDisplay: string
  status?: string
  pdf_url?: string
  official_link?: string
  created_at: string
  originalExam?: Exam
  originalNotif?: Notification
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'exam', label: 'Exams' },
  { value: 'result', label: 'Results' },
  { value: 'admit_card', label: 'Admit Cards' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'answer_key', label: 'Answer Keys' },
]

export default function ExamsTable() {
  const supabase = createClient()
  const [listings, setListings] = useState<UnifiedListing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editExam, setEditExam] = useState<Exam | null>(null)
  
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; source: 'exam' | 'notification'; title: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [examsRes, notifsRes] = await Promise.all([
        supabase.from('exams').select('*, categories(id,name,slug)').order('created_at', { ascending: false }),
        supabase.from('notifications').select('*, exams(title)').order('published_at', { ascending: false }),
      ])

      const examItems: UnifiedListing[] = (examsRes.data ?? []).map(e => ({
        id: e.id,
        source: 'exam',
        contentType: 'exam',
        typeLabel: 'Exam Notification',
        title: e.title,
        subtitle: e.department || e.categories?.name || 'Recruitment Exam',
        dateDisplay: e.application_end ? `End: ${e.application_end}` : 'Date: Pending',
        status: e.status,
        official_link: e.official_link,
        created_at: e.created_at,
        originalExam: e,
      }))

      const notifItems: UnifiedListing[] = (notifsRes.data ?? []).map(n => {
        let label = 'Notification'
        if (n.type === 'result') label = 'Result'
        else if (n.type === 'admit_card') label = 'Admit Card'
        else if (n.type === 'answer_key') label = 'Answer Key'
        else if (n.type === 'syllabus') label = 'Syllabus'
        else if (n.type === 'new_job') label = 'New Job Alert'

        return {
          id: n.id,
          source: 'notification',
          contentType: n.type,
          typeLabel: label,
          title: n.title,
          subtitle: (n as any).exams?.title ? `Linked to: ${(n as any).exams.title}` : 'General Alert',
          dateDisplay: `Published: ${new Date(n.published_at).toLocaleDateString('en-IN')}`,
          pdf_url: n.pdf_url,
          created_at: n.published_at,
          originalNotif: n,
        }
      })

      const combined = [...examItems, ...notifItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setListings(combined)
    } catch (err: any) {
      console.error('Failed to load unified listings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = listings.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.subtitle ?? '').toLowerCase().includes(search.toLowerCase())

    const matchesType =
      typeFilter === 'all' ||
      (typeFilter === 'exam' && item.source === 'exam') ||
      (typeFilter !== 'exam' && item.contentType === typeFilter)

    return matchesSearch && matchesType
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      if (deleteTarget.source === 'exam') {
        await supabase.from('exams').delete().eq('id', deleteTarget.id)
      } else {
        await supabase.from('notifications').delete().eq('id', deleteTarget.id)
      }
      setDeleteTarget(null)
      fetchData()
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const renderBadge = (item: UnifiedListing) => {
    if (item.source === 'exam') {
      return <Badge status={item.status as any} />
    }
    const colors: Record<string, string> = {
      result: 'bg-green-100 text-green-700 border-green-200',
      admit_card: 'bg-blue-100 text-blue-700 border-blue-200',
      answer_key: 'bg-purple-100 text-purple-700 border-purple-200',
      syllabus: 'bg-amber-100 text-amber-800 border-amber-200',
      new_job: 'bg-orange-100 text-orange-700 border-orange-200',
    }
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colors[item.contentType] ?? 'bg-gray-100 text-gray-700'}`}>
        ● {item.typeLabel}
      </span>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[#0F1C30] font-bold text-2xl">Content Listings</h1>
          <p className="text-[#5B6880] text-sm mt-1">
            Manage all recruitment exams and posted notifications in one place ({filtered.length} item{filtered.length !== 1 ? 's' : ''})
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, department, or linked exam…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/10"
          />
        </div>
        
        {/* Content Type Filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E] font-medium"
        >
          {TYPE_OPTIONS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1.5">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#5B6880] text-sm">Loading listings…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#5B6880] text-sm">
            <FileText size={32} className="text-gray-300 mb-1" />
            <p className="font-semibold text-[#0F1C30]">No matching listings found.</p>
            <p className="text-xs text-[#5B6880]">Try adjusting your search query or type filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#EEF2F8] border-b border-gray-100">
                  <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-5 py-3.5">
                    Listing Title &amp; Details
                  </th>
                  <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">
                    Type
                  </th>
                  <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">
                    Status / Details
                  </th>
                  <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">
                    Date
                  </th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item, i) => (
                  <tr key={`${item.source}-${item.id}`} className={`group hover:bg-[#FFF7F0] transition-colors ${i % 2 ? 'bg-[#FAFBFD]' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          item.source === 'exam' ? 'bg-[#1A3C6E]/10 text-[#1A3C6E]' : 'bg-[#FF7A00]/10 text-[#FF7A00]'
                        }`}>
                          {item.source === 'exam' ? <FileText size={14} /> : <Bell size={14} />}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F1C30] text-sm leading-snug">{item.title}</p>
                          <p className="text-[#5B6880] text-xs mt-0.5">{item.subtitle}</p>
                          {item.pdf_url && (
                            <a href={item.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF7A00] hover:underline mt-1">
                              <Download size={11} /> Download PDF
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">{renderBadge(item)}</td>
                    <td className="px-4 py-4 text-xs font-medium text-[#5B6880]">{item.dateDisplay}</td>
                    <td className="px-4 py-4 text-xs text-[#5B6880]">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.source === 'exam' && (
                          <button
                            onClick={() => { setEditExam(item.originalExam!); setModalOpen(true) }}
                            className="p-1.5 text-[#1A3C6E] hover:bg-[#EEF2F8] rounded-lg transition-colors"
                            title="Edit Exam"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget({ id: item.id, source: item.source, title: item.title })}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Listing"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal (for Exam edits) */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditExam(null) }}
        title="Edit Exam Listing"
        width="max-w-3xl"
      >
        <ExamForm
          exam={editExam}
          categories={[]}
          onSuccess={() => { setModalOpen(false); setEditExam(null); fetchData() }}
          onCancel={() => { setModalOpen(false); setEditExam(null) }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Listing">
        <p className="text-[#5B6880] text-sm mb-2 font-medium">
          Are you sure you want to delete: <span className="font-bold text-[#0F1C30]">{deleteTarget?.title}</span>?
        </p>
        <p className="text-xs text-red-500 mb-6">
          This action will permanently delete this {deleteTarget?.source} record.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
