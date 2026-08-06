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
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  
  // On-the-fly tags state for this post
  const [postTags, setPostTags] = useState<{ name: string; color: string }[]>([])
  const [tagInput, setTagInput] = useState('')

  const [examForm, setExamForm] = useState({
    title: '',
    slug: '',
    category_id: '',
    description: '',
    application_start: '',
    application_end: '',
    auto_delete_at: '',
    exam_date: '',
    status: 'upcoming' as ExamStatus,
    is_all_india: false,
  })

  // Links state: array of {label, url} rows
  const [examLinks, setExamLinks] = useState<{ label: string; url: string }[]>([])

  const addLink = (label: string = '') => setExamLinks(prev => [...prev, { label, url: '' }])
  const removeLink = (i: number) => setExamLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: 'label' | 'url', val: string) =>
    setExamLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  const [notAnnouncedAppEnd, setNotAnnouncedAppEnd] = useState(false)

  const COLOR_PRESETS = ['#1A3C6E', '#FF7A00', '#059669', '#7C3AED', '#DC2626', '#DB2777', '#0284C7', '#D97706']

  const handleAddPostTag = () => {
    const trimmed = tagInput.trim()
    if (!trimmed) return
    if (postTags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setTagInput('')
      return
    }
    const color = COLOR_PRESETS[postTags.length % COLOR_PRESETS.length]
    setPostTags(prev => [...prev, { name: trimmed, color }])
    setTagInput('')
  }

  const handleRemovePostTag = (index: number) => {
    setPostTags(prev => prev.filter((_, i) => i !== index))
  }

  // ── Notification form state ──
  const [allExams, setAllExams] = useState<{ id: string; title: string }[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [showExamDropdown, setShowExamDropdown] = useState(false)
  const [selectedExam, setSelectedExam] = useState<{ id: string; title: string } | null>(null)
  const [notifTitle, setNotifTitle] = useState('')
  const [notifLinkUrl, setNotifLinkUrl] = useState('')
  const [notifDescription, setNotifDescription] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  // ── Load reference data on mount ──
  useEffect(() => {
    if (!open) return
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data ?? []))
    supabase.from('states').select('*').order('name').then(({ data }) => setStates(data ?? []))
    supabase.from('exams').select('id, title').order('title').then(({ data }) => setAllExams(data ?? []))
  }, [open])

  // ── Reset everything when modal closes ──
  const resetAll = useCallback(() => {
    setContentType(null)
    setError(null)
    setSuccess(false)
    setLoading(false)
    setSelectedStates([])
    setPostTags([])
    setTagInput('')
    setExamForm({
      title: '', slug: '', category_id: '', description: '',
      application_start: '', application_end: '', auto_delete_at: '',
      exam_date: '', status: 'upcoming', is_all_india: false,
    })
    setExamLinks([])
    setSelectedExam(null)
    setExamSearch('')
    setNotifTitle('')
    setNotifLinkUrl('')
    setNotifDescription('')
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
          department: null,
          qualification: null,
          age_limit: null,
          vacancy_count: null,
          official_link: null,
          details: null,
          category_id: examForm.category_id || null,
          exam_date: null,
          application_start: null,
          application_end: notAnnouncedAppEnd ? null : (examForm.application_end || null),
          auto_delete_at: examForm.auto_delete_at || null,
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

        // Sync job tags (upserting tags on-the-fly)
        if (postTags.length > 0) {
          const tagIds: string[] = []
          for (const t of postTags) {
            const slug = slugify(t.name)
            const { data: existing } = await supabase.from('job_tags').select('id').eq('slug', slug).maybeSingle()
            if (existing) {
              tagIds.push(existing.id)
            } else {
              const { data: created } = await supabase.from('job_tags').insert({
                name: t.name,
                slug,
                color: t.color,
              }).select('id').single()
              if (created) tagIds.push(created.id)
            }
          }
          if (tagIds.length > 0) {
            await supabase.from('exam_job_tags').insert(
              tagIds.map(job_tag_id => ({ exam_id: examId, job_tag_id }))
            )
          }
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
          link_url: notifLinkUrl.trim() || null,
          description: notifDescription.trim() || null,
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
                  <Field label="Status" required>
                    <select className={INPUT_CLS} value={examForm.status} onChange={e => setExamField('status', e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </Field>
                  <Field label="Application End (Last Date)">
                    <input
                      type="text"
                      className={INPUT_CLS}
                      value={examForm.application_end}
                      onChange={e => setExamField('application_end', e.target.value)}
                      disabled={notAnnouncedAppEnd}
                      placeholder="e.g. 25-08-2026 or 25 Aug 2026"
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
                  {/* Auto Delete Date */}
                  <Field label="Auto Delete Date">
                    <input
                      type="text"
                      className={INPUT_CLS}
                      value={examForm.auto_delete_at}
                      onChange={e => setExamField('auto_delete_at', e.target.value)}
                      placeholder="e.g. 2026-08-30 or 30 Aug 2026"
                    />
                    <p className="text-xs text-[#5B6880] mt-1">Optional — post will be automatically deleted on this date</p>
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#0F1C30] uppercase tracking-wider flex items-center gap-2">
                      <Link size={13} className="text-[#1A3C6E]" /> Additional / Important Links
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => addLink('Syllabus')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-sky-100 text-sky-800 rounded-md hover:bg-sky-200 transition-colors"
                      >
                        + Syllabus Link
                      </button>
                      <button
                        type="button"
                        onClick={() => addLink('Admit Card')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors"
                      >
                        + Admit Card Link
                      </button>
                      <button
                        type="button"
                        onClick={() => addLink('Answer Key')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 transition-colors"
                      >
                        + Answer Key Link
                      </button>
                      <button
                        type="button"
                        onClick={() => addLink('Result')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-md hover:bg-emerald-200 transition-colors"
                      >
                        + Result Link
                      </button>
                      <button
                        type="button"
                        onClick={() => addLink('')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-0.5"
                      >
                        <Plus size={12} /> Custom Link
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#5B6880]">Add supplementary links (Official PDF, Syllabus, Apply Online, Result, Answer Key). These appear on the public exam page.</p>

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

                {/* Job Type Tags — Dynamic Pills Creator */}
                <Field label="Job Type Tags">
                  <p className="text-xs text-[#5B6880] mb-2">Type a tag name and press Enter or click Add Tag (e.g. Apprentice, Police, Result).</p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddPostTag()
                        }
                      }}
                      placeholder="Enter tag name…"
                      className={`${INPUT_CLS} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={handleAddPostTag}
                      disabled={!tagInput.trim()}
                      className="px-4 py-2 bg-[#1A3C6E] text-white text-xs font-bold rounded-lg hover:bg-[#FF7A00] transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      + Add Tag
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {postTags.length === 0 ? (
                      <p className="text-xs text-[#5B6880] italic">No tags added for this post yet.</p>
                    ) : (
                      postTags.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-xs"
                          style={{ backgroundColor: t.color + '25', color: t.color }}
                        >
                          ● {t.name}
                          <button
                            type="button"
                            onClick={() => handleRemovePostTag(idx)}
                            className="hover:opacity-80 transition-opacity ml-0.5"
                            title="Remove tag"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))
                    )}
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

                {/* Direct Link URL */}
                <Field label="Direct Link / Website URL" hint="Optional — direct website link to check result, download admit card, or view answer key">
                  <input
                    type="url"
                    value={notifLinkUrl}
                    onChange={e => setNotifLinkUrl(e.target.value)}
                    placeholder="https://ssc.gov.in/result"
                    className={INPUT_CLS}
                  />
                </Field>

                {/* Description / Instructions */}
                <Field label="Description / Details" hint="Optional — write details, instructions, or cut-off info for users">
                  <textarea
                    value={notifDescription}
                    onChange={e => setNotifDescription(e.target.value)}
                    placeholder="Write details, cut-off info, or instructions for users..."
                    className={`${INPUT_CLS} min-h-24 resize-y`}
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
