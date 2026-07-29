'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Category } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ExamForm from './ExamForm'
import { Search, Pencil, Trash2, RefreshCw } from 'lucide-react'

const STATUSES: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'result_declared', label: 'Result Declared' },
]

export default function ExamsTable() {
  const supabase = createClient()
  const [exams, setExams] = useState<Exam[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortField, setSortField] = useState<'title' | 'created_at' | 'application_end'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editExam, setEditExam] = useState<Exam | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('exams')
      .select('*, categories(id,name,slug,icon)')
      .order(sortField, { ascending: sortDir === 'asc' })

    if (statusFilter) query = query.eq('status', statusFilter)
    if (categoryFilter) query = query.eq('category_id', categoryFilter)

    const { data } = await query
    setExams(data ?? [])
    setLoading(false)
  }, [sortField, sortDir, statusFilter, categoryFilter])

  useEffect(() => {
    fetchData()
    supabase.from('categories').select('*').then(({ data }) => setCategories(data ?? []))
  }, [fetchData])

  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.department ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    await supabase.from('exams').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleteLoading(false)
    fetchData()
  }

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? (sortDir === 'asc' ? <span>↑</span> : <span>↓</span>) : <span className="text-gray-300">↕</span>

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[#0F1C30] font-bold text-2xl">Exams</h1>
          <p className="text-[#5B6880] text-sm mt-1">{filtered.length} exam{filtered.length !== 1 ? 's' : ''} found</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exams or department…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E]"
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E]"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1.5">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#5B6880] text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[#5B6880] text-sm">No exams found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#EEF2F8] border-b border-gray-100">
                  <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-5 py-3.5 cursor-pointer hover:text-[#FF7A00]" onClick={() => handleSort('title')}>
                    Title <SortIcon field="title" />
                  </th>
                  <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">Category</th>
                  <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5 cursor-pointer hover:text-[#FF7A00]" onClick={() => handleSort('application_end')}>
                    Last Date <SortIcon field="application_end" />
                  </th>
                  <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-[#1A3C6E] uppercase tracking-wider cursor-pointer hover:text-[#FF7A00]" onClick={() => handleSort('created_at')}>
                    Created <SortIcon field="created_at" />
                  </th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((exam, i) => (
                  <tr key={exam.id} className={`group hover:bg-[#FFF7F0] transition-colors ${i % 2 ? 'bg-[#FAFBFD]' : ''}`}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#0F1C30] text-sm">{exam.title}</p>
                      <p className="text-[#5B6880] text-xs mt-0.5">{exam.department ?? '—'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#5B6880]">{(exam as any).categories?.name ?? '—'}</td>
                    <td className="px-4 py-4 text-sm text-[#5B6880]">{exam.application_end ?? '—'}</td>
                    <td className="px-4 py-4"><Badge status={exam.status} /></td>
                    <td className="px-4 py-4 text-xs text-[#5B6880]">{new Date(exam.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditExam(exam); setModalOpen(true) }}
                          className="p-1.5 text-[#1A3C6E] hover:bg-[#EEF2F8] rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(exam.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
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

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditExam(null) }}
        title={editExam ? 'Edit Exam' : 'Add New Exam'}
        width="max-w-3xl"
      >
        <ExamForm
          exam={editExam}
          categories={categories}
          onSuccess={() => { setModalOpen(false); setEditExam(null); fetchData() }}
          onCancel={() => { setModalOpen(false); setEditExam(null) }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Exam">
        <p className="text-[#5B6880] text-sm mb-6">
          Are you sure you want to delete this exam? This will also remove all linked notifications and exam-state relationships.
        </p>
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
