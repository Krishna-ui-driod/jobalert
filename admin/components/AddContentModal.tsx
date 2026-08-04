'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, State, ExamStatus, JobTag } from '@/lib/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Search, Send, FileText, Bell, X, Plus, Trash2, Link, AlertTriangle } from 'lucide-react'
import { detectMalformedTable } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

type ContentType =
  | 'new_exam'
  | 'admit_card'
  | 'result'
  | 'answer_key'
  | 'syllabus'

interface ContentOption {
  value: ContentType
  label: string
  description: string
  icon: typeof FileText
  dbType?: string // maps to notification_type enum
}

const CONTENT_OPTIONS: ContentOption[] = [
  { value: 'new_exam',    label: 'New Exam / Recruitment', description: 'Add a new exam listing',                   icon: FileText },
  { value: 'admit_card',  label: 'Admit Card',             description: 'Admit card available for download',        icon: Bell, dbType: 'admit_card' },
  { value: 'result',      label: 'Result',                 description: 'Result declared / scorecards available',   icon: Bell, dbType: 'result' },
  { value: 'answer_key',  label: 'Answer Key',             description: 'Answer key released',                      icon: Bell, dbType: 'answer_key' },
  { value: 'syllabus',    label: 'Syllabus',               description: 'Syllabus / exam pattern published',        icon: Bell, dbType: 'syllabus' },
]

const STATUSES: ExamStatus[] = ['upcoming', 'active', 'closed', 'result_declared']

// ── Field wrapper — defined outside to avoid remount ──────────────────────────

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[#5B6880] mt-1">{hint}</p>}
    </div>
  )
}

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/10 transition-all"

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Main component ────────────────────────────────────────────────────────────

interface AddContentModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddContentModal({ open, onClose, onSuccess }: AddContentModalProps) {
  const supabase = createClient()

  // ── Content type selection ──
  const [contentType, setContentType] = useState<ContentType | null>(null)

  // ── Shared state ──
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Exam form state ──
  const [categories, setCategories] = useState<Category[]>([])
  const [states, setStates] = useState<State[]>([])
  const [jobTags, setJobTags] = useState<JobTag[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [selectedJobTags, setSelectedJobTags] = useState<string[]>([])
  const [examForm, setExamForm] = useState({
    title: '',
    slug: '',
    category_id: '',
    department: '',
    description: '',
    qualification: '',
    age_limit: '',
    application_start: '',
    application_end: '',
    exam_date: '',
    status: 'upcoming' as ExamStatus,
    official_link: '',
    is_all_india: false,
    vacancy_count: '',
  })

  // Links state: array of {label, url} rows
  const [examLinks, setExamLinks] = useState<{ label: string; url: string }[]>([])

  const addLink = () => setExamLinks(prev => [...prev, { label: '', url: '' }])
  const removeLink = (i: number) => setExamLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: 'label' | 'url', val: string) =>
    setExamLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  const [newTagModalOpen, setNewTagModalOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#1A3C6E')
  const [creatingTag, setCreatingTag] = useState(false)

  const [notAnnouncedAppEnd, setNotAnnouncedAppEnd] = useState(false)
  const [pendingOfficialLink, setPendingOfficialLink] = useState(false)

  const COLOR_PRESETS = ['#1A3C6E', '#FF7A00', '#059669', '#7C3AED', '#DC2626', '#DB2777', '#0284C7', '#D97706']

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    try {
      const slug = slugify(newTagName)
      const { data, error } = await supabase
        .from('job_tags')
        .insert({ name: newTagName.trim(), slug, color: newTagColor })
        .select()
        .single()
      if (error) throw error
      if (data) {
        setJobTags(prev => [...prev, data])
        setSelectedJobTags(prev => [...prev, data.id])
        setNewTagName('')
        setNewTagModalOpen(false)
      }
    } catch (err: any) {
      alert(`Error creating tag: ${err.message}`)
    } finally {
      setCreatingTag(false)
    }
  }

  // ── Notification form state ──
  const [allExams, setAllExams] = useState<{ id: string; title: string }[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [showExamDropdown, setShowExamDropdown] = useState(false)
  const [selectedExam, setSelectedExam] = useState<{ id: string; title: string } | null>(null)
  const [notifTitle, setNotifTitle] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  // ── Load reference data on mount ──
  useEffect(() => {
    if (!open) return
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data ?? []))
    supabase.from('states').select('*').order('name').then(({ data }) => setStates(data ?? []))
    supabase.from('job_tags').select('*').order('name').then(({ data }) => setJobTags(data ?? []))
    supabase.from('exams').select('id, title').order('title').then(({ data }) => setAllExams(data ?? []))
  }, [open])

  // ── Reset everything when modal closes ──
  const resetAll = useCallback(() => {
    setContentType(null)
    setError(null)
    setSuccess(false)
    setLoading(false)
    setSelectedStates([])
    setSelectedJobTags([])
    setExamForm({
      title: '', slug: '', category_id: '', department: '', description: '',
      qualification: '', age_limit: '', application_start: '', application_end: '',
      exam_date: '', status: 'upcoming', official_link: '', is_all_india: false,
      vacancy_count: '',
    })
    setExamLinks([])
    setSelectedExam(null)
    setExamSearch('')
    setNotifTitle('')
    setPdfFile(null)
    setShowExamDropdown(false)
  }, [])

  const handleClose = () => {
    resetAll()
    onClose()
  }

  // ── Exam form helpers ──
  const setExamField = (field: string, value: string | boolean) =>
    setExamForm(f => ({ ...f, [field]: value }))

  const handleExamTitleChange = (v: string) =>
    setExamForm(f => ({ ...f, title: v, slug: slugify(v) }))

  const toggleState = (id: string) =>
    setSelectedStates(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const toggleJobTag = (id: string) =>
    setSelectedJobTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  // ── Notification helpers ──
  const filteredExams = allExams.filter(e =>
    e.title.toLowerCase().includes(examSearch.toLowerCase())
  )

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (contentType === 'new_exam') {
        const payload = {
          ...examForm,
          description: (examForm.description ?? '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n'),
          vacancy_count: examForm.vacancy_count !== '' && examForm.vacancy_count !== null ? Number(examForm.vacancy_count) : null,
          details: null,
          category_id: examForm.category_id || null,
          exam_date: examForm.exam_date || null,
          application_start: examForm.application_start || null,
          application_end: notAnnouncedAppEnd ? null : (examForm.application_end || null),
          official_link: pendingOfficialLink ? null : (examForm.official_link || null),
        }

        const { data, error: insertErr } = await supabase.from('exams').insert(payload).select().single()
        if (insertErr) throw insertErr

        const examId = data.id

        // Sync states
        if (!examForm.is_all_india && selectedStates.length > 0) {
          await supabase.from('exam_states').insert(
            selectedStates.map(state_id => ({ exam_id: examId, state_id }))
          )
        }

        // Sync job tags
        if (selectedJobTags.length > 0) {
          await supabase.from('exam_job_tags').insert(
            selectedJobTags.map(job_tag_id => ({ exam_id: examId, job_tag_id }))
          )
        }

        // Sync exam_links
        const validLinks = examLinks.filter(l => l.label.trim() && l.url.trim())
        if (validLinks.length > 0) {
          await supabase.from('exam_links').insert(
            validLinks.map((l, i) => ({ exam_id: examId, label: l.label.trim(), url: l.url.trim(), display_order: i }))
          )
        }
      } else {
        // ──── Save notification ────
        if (!selectedExam) {
          throw new Error('Please select a linked exam')
        }

        const option = CONTENT_OPTIONS.find(o => o.value === contentType)
        const dbType = option?.dbType ?? 'new_job'

        let pdf_url: string | null = null
        if (pdfFile) {
          const path = `notifications/${Date.now()}-${pdfFile.name}`
          const { error: uploadErr } = await supabase.storage
            .from('pdfs').upload(path, pdfFile, { upsert: true })
          if (uploadErr) throw uploadErr
          const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(path)
          pdf_url = urlData.publicUrl
        }

        const { error: insertErr } = await supabase.from('notifications').insert({
          exam_id: selectedExam.id,
          type: dbType,
          title: notifTitle,
          pdf_url,
          published_at: new Date().toISOString(),
        })
        if (insertErr) throw insertErr
      }

      setSuccess(true)
      setTimeout(() => {
        handleClose()
        onSuccess()
      }, 800)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const isExamFlow = contentType === 'new_exam'
  const isNotifFlow = contentType !== null && contentType !== 'new_exam'

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={contentType ? (isExamFlow ? '➕ Add New Exam' : `➕ Post ${CONTENT_OPTIONS.find(o => o.value === contentType)?.label}`) : '➕ Add New Content'}
      width="max-w-3xl"
    >
      <form onSubmit={handleSubmit}>
        {/* Status messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-5">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
            ✓ {isExamFlow ? 'Exam created successfully!' : 'Notification posted successfully!'}
          </div>
        )}

        {/* ── Step 1: Content type selector ── */}
        {contentType === null ? (
          <div className="space-y-3">
            <p className="text-[#5B6880] text-sm mb-4">What are you posting?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setContentType(opt.value)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-[#1A3C6E] hover:bg-[#EEF2F8] transition-all text-left group"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    opt.value === 'new_exam'
                      ? 'bg-[#1A3C6E]/10 group-hover:bg-[#1A3C6E]/20'
                      : 'bg-[#FF7A00]/10 group-hover:bg-[#FF7A00]/20'
                  }`}>
                    <opt.icon size={18} className={opt.value === 'new_exam' ? 'text-[#1A3C6E]' : 'text-[#FF7A00]'} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F1C30] text-sm">{opt.label}</p>
                    <p className="text-[#5B6880] text-xs mt-0.5">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Back button */}
            <button
              type="button"
              onClick={() => { setContentType(null); setError(null) }}
              className="text-[#5B6880] hover:text-[#1A3C6E] text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              ← Change content type
            </button>

            {/* ── Exam form fields ── */}
            {isExamFlow && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Title" required>
                    <input className={INPUT_CLS} value={examForm.title} onChange={e => handleExamTitleChange(e.target.value)} required />
                  </Field>
                  <Field label="Slug" required>
                    <input className={INPUT_CLS} value={examForm.slug} onChange={e => setExamField('slug', e.target.value)} required placeholder="ssc-cgl-2026" />
                  </Field>
                  <Field label="Department">
                    <input className={INPUT_CLS} value={examForm.department} onChange={e => setExamField('department', e.target.value)} placeholder="Staff Selection Commission" />
                  </Field>
                  <Field label="Status" required>
                    <select className={INPUT_CLS} value={examForm.status} onChange={e => setExamField('status', e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </Field>
                  <Field label="Official Website (Apply Link)">
                    <input
                      className={INPUT_CLS}
                      value={examForm.official_link}
                      onChange={e => setExamField('official_link', e.target.value)}
                      placeholder="https://ssc.gov.in"
                      disabled={pendingOfficialLink}
                    />
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer text-xs text-[#5B6880]">
                      <input
                        type="checkbox"
                        checked={pendingOfficialLink}
                        onChange={e => {
                          setPendingOfficialLink(e.target.checked)
                          if (e.target.checked) setExamField('official_link', '')
                        }}
                        className="accent-[#1A3C6E]"
                      />
                      <span>Link pending / not announced yet</span>
                    </label>
                  </Field>
                  <Field label="Qualification">
                    <input className={INPUT_CLS} value={examForm.qualification} onChange={e => setExamField('qualification', e.target.value)} placeholder="Graduation" />
                  </Field>
                  <Field label="Age Limit Summary">
                    <input className={INPUT_CLS} value={examForm.age_limit} onChange={e => setExamField('age_limit', e.target.value)} placeholder="18–32 years" />
                  </Field>
                  <Field label="Total Posts / Vacancies">
                    <input type="number" min="0" className={INPUT_CLS} value={examForm.vacancy_count} onChange={e => setExamField('vacancy_count', e.target.value)} placeholder="e.g. 17727 (Leave empty if not announced)" />
                  </Field>
                  <Field label="Application Start">
                    <input type="date" className={INPUT_CLS} value={examForm.application_start} onChange={e => setExamField('application_start', e.target.value)} />
                  </Field>
                  <Field label="Application End (Last Date)">
                    <input
                      type="date"
                      className={INPUT_CLS}
                      value={examForm.application_end}
                      onChange={e => setExamField('application_end', e.target.value)}
                      disabled={notAnnouncedAppEnd}
                    />
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer text-xs text-[#5B6880]">
                      <input
                        type="checkbox"
                        checked={notAnnouncedAppEnd}
                        onChange={e => {
                          setNotAnnouncedAppEnd(e.target.checked)
                          if (e.target.checked) setExamField('application_end', '')
                        }}
                        className="accent-[#1A3C6E]"
                      />
                      <span>Not yet announced</span>
                    </label>
                  </Field>
                  <Field label="Exam Date">
                    <input type="date" className={INPUT_CLS} value={examForm.exam_date} onChange={e => setExamField('exam_date', e.target.value)} />
                  </Field>
                </div>

                {/* Description / Exam Details */}
                <Field label="Exam Details / Description">
                  <p className="text-xs text-[#5B6880] mb-2">Write a full description of this exam/job notification — eligibility, vacancies, selection process, fees, how to apply, etc.</p>
                  <textarea
                    className={`${INPUT_CLS} min-h-48 resize-y`}
                    value={examForm.description}
                    onChange={e => setExamField('description', e.target.value)}
                    placeholder={`Official recruitment notification released. Eligible candidates can apply online.\n\nEligibility: Bachelor's degree\nVacancies: e.g. 17,727 posts\nFee: General Rs.100 | SC/ST Free\nHow to Apply: Visit the official website and complete registration`}
                  />
                  {detectMalformedTable(examForm.description) && (
                    <div className="mt-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-lg flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                      <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold text-amber-950">Table Formatting Warning: </span>
                        This looks like a malformed table — check that every row has the same number of | columns and a separator row (|---|---|) is right after the header.
                      </div>
                    </div>
                  )}
                </Field>

                {/* Additional Links Section */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0F1C30] uppercase tracking-wider flex items-center gap-2">
                      <Link size={13} className="text-[#1A3C6E]" /> Additional Links
                    </label>
                    <button
                      type="button"
                      onClick={addLink}
                      className="flex items-center gap-1 text-xs font-bold text-[#FF7A00] hover:text-[#E86E00] transition-colors"
                    >
                      <Plus size={13} /> Add Link
                    </button>
                  </div>
                  <p className="text-xs text-[#5B6880]">Add supplementary links (e.g. Official PDF, Syllabus, Apply Online, Check Result). These appear on the public exam page.</p>

                  {examLinks.length === 0 ? (
                    <p className="text-xs text-[#5B6880] italic">No links added yet. Click "+ Add Link" to add one.</p>
                  ) : (
                    <div className="space-y-2">
                      {examLinks.map((link, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={link.label}
                            onChange={e => updateLink(i, 'label', e.target.value)}
                            placeholder="Label (e.g. Official PDF)"
                            className="flex-[2] border border-gray-200 rounded-lg px-3 py-2 text-xs text-[#0F1C30] outline-none focus:border-[#1A3C6E] focus:ring-1 focus:ring-[#1A3C6E]/20 transition-all"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={e => updateLink(i, 'url', e.target.value)}
                            placeholder="https://..."
                            className="flex-[3] border border-gray-200 rounded-lg px-3 py-2 text-xs text-[#0F1C30] outline-none focus:border-[#1A3C6E] focus:ring-1 focus:ring-[#1A3C6E]/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => removeLink(i)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Job Type Tags (Fix 6a: Create on the fly) */}
                <Field label="Job Type Tags">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#5B6880]">{selectedJobTags.length} tag(s) selected</span>
                    <button
                      type="button"
                      onClick={() => setNewTagModalOpen(!newTagModalOpen)}
                      className="text-xs font-bold text-[#FF7A00] hover:underline flex items-center gap-1"
                    >
                      + Create New Tag
                    </button>
                  </div>

                  {/* Inline New Tag Creator */}
                  {newTagModalOpen && (
                    <div className="bg-[#EEF2F8] p-3 rounded-lg border border-[#1A3C6E]/20 mb-3 space-y-2">
                      <p className="text-xs font-bold text-[#0F1C30]">Add New Job Tag</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={e => setNewTagName(e.target.value)}
                          placeholder="e.g. Apprentice, Assistant"
                          className="flex-1 border border-gray-300 rounded px-2.5 py-1 text-xs text-[#0F1C30] outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleCreateTag}
                          disabled={creatingTag || !newTagName.trim()}
                          className="bg-[#1A3C6E] text-white font-bold text-xs px-3 py-1 rounded hover:bg-[#FF7A00] transition-colors disabled:opacity-50"
                        >
                          {creatingTag ? 'Creating…' : 'Save Tag'}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-[#5B6880] font-medium mr-1">Badge Color:</span>
                        {COLOR_PRESETS.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewTagColor(c)}
                            className={`w-5 h-5 rounded-full border border-black/10 transition-transform ${newTagColor === c ? 'scale-125 ring-2 ring-[#1A3C6E]' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {jobTags.length === 0 ? (
                      <p className="text-xs text-[#5B6880] col-span-full">No tags found. Click "+ Create New Tag" above to add your first tag.</p>
                    ) : jobTags.map(tag => (
                      <label key={tag.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedJobTags.includes(tag.id)}
                          onChange={() => toggleJobTag(tag.id)}
                          className="accent-[#1A3C6E]"
                        />
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: tag.color + '20', color: tag.color }}
                        >
                          ● {tag.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>

                {/* All India toggle */}
                <Field label="Geographic Scope">
                  <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:border-[#1A3C6E]/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={examForm.is_all_india}
                      onChange={e => setExamField('is_all_india', e.target.checked)}
                      className="accent-[#1A3C6E] w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#0F1C30]">All India / Central Govt exam</p>
                      <p className="text-xs text-[#5B6880]">Check this if the exam is not limited to specific states</p>
                    </div>
                  </label>
                </Field>

                {/* States multi-select */}
                {!examForm.is_all_india && (
                  <Field label="Applicable States / UTs">
                    <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {states.map(s => (
                        <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={selectedStates.includes(s.id)}
                            onChange={() => toggleState(s.id)}
                            className="accent-[#1A3C6E]"
                          />
                          <span className="text-[#0F1C30]">{s.name}</span>
                          <span className="text-gray-400 text-xs">({s.code})</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-[#5B6880] mt-1">{selectedStates.length} state(s) selected</p>
                  </Field>
                )}
              </>
            )}

            {/* ── Notification form fields ── */}
            {isNotifFlow && (
              <>
                {/* Linked exam (required) */}
                <Field label="Linked Exam" required hint="Select which exam this notification is for">
                  <div className="relative">
                    {selectedExam ? (
                      <div className="flex items-center gap-2 border border-[#1A3C6E] bg-[#EEF2F8] rounded-lg px-3 py-2">
                        <span className="text-sm text-[#0F1C30] font-medium flex-1 truncate">{selectedExam.title}</span>
                        <button
                          type="button"
                          onClick={() => { setSelectedExam(null); setExamSearch('') }}
                          className="text-gray-400 hover:text-red-500 text-xs font-bold"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={examSearch}
                          onChange={e => { setExamSearch(e.target.value); setShowExamDropdown(true) }}
                          onFocus={() => setShowExamDropdown(true)}
                          onBlur={() => setTimeout(() => setShowExamDropdown(false), 150)}
                          placeholder="Search exam…"
                          className={`${INPUT_CLS} pl-9`}
                        />
                        {showExamDropdown && filteredExams.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredExams.slice(0, 20).map(ex => (
                              <button
                                key={ex.id}
                                type="button"
                                onMouseDown={() => { setSelectedExam(ex); setExamSearch(''); setShowExamDropdown(false) }}
                                className="w-full text-left px-4 py-2.5 text-sm text-[#0F1C30] hover:bg-[#EEF2F8] transition-colors border-b border-gray-50 last:border-0"
                              >
                                {ex.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Field>

                {/* Title */}
                <Field label="Notification Title" required>
                  <input
                    value={notifTitle}
                    onChange={e => setNotifTitle(e.target.value)}
                    required
                    placeholder={`${CONTENT_OPTIONS.find(o => o.value === contentType)?.label} — enter details`}
                    className={INPUT_CLS}
                  />
                </Field>

                {/* PDF */}
                <Field label="PDF Attachment" hint="Optional — attach an official PDF document">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#EEF2F8] file:text-[#1A3C6E] hover:file:bg-[#1A3C6E] hover:file:text-white transition-all"
                  />
                </Field>
              </>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                <Send size={14} />
                {loading ? 'Saving…' : isExamFlow ? 'Create Exam' : 'Post Notification'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
