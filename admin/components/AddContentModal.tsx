'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, State, ExamStatus, JobTag, ExamDetails } from '@/lib/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Search, Send, FileText, Bell, X } from 'lucide-react'

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

  const [details, setDetails] = useState<ExamDetails>({
    overview: '',
    vacancy_details: '',
    eligibility: '',
    age_limit: '',
    stipend_benefits: '',
    selection_process: '',
    how_to_apply: '',
    application_fee: '',
    important_dates_note: '',
  })
  type DetailsTab = 'overview' | 'vacancy_details' | 'eligibility' | 'age_limit' | 'stipend_benefits' | 'selection_process' | 'how_to_apply' | 'application_fee' | 'important_dates_note'
  const [activeDetailsTab, setActiveDetailsTab] = useState<DetailsTab>('overview')

  const setDetailField = (key: keyof ExamDetails, value: string) => {
    setDetails(prev => ({ ...prev, [key]: value }))
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
    setDetails({
      overview: '', vacancy_details: '', eligibility: '', age_limit: '',
      stipend_benefits: '', selection_process: '', how_to_apply: '',
      application_fee: '', important_dates_note: '',
    })
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
        // ──── Save exam ────
        if (!examForm.application_end) {
          throw new Error('Please select "Last Date to Apply" before saving.')
        }

        if (!examForm.official_link || !examForm.official_link.trim()) {
          throw new Error('Please enter the "Official Website (Apply Link)" before saving.')
        }

        const payload = {
          ...examForm,
          vacancy_count: examForm.vacancy_count !== '' && examForm.vacancy_count !== null ? Number(examForm.vacancy_count) : null,
          description: details.overview || examForm.description,
          details,
          category_id: examForm.category_id || null,
          exam_date: examForm.exam_date || null,
          application_start: examForm.application_start || null,
          application_end: examForm.application_end || null,
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

        // Also create a "new_job" notification automatically
        await supabase.from('notifications').insert({
          exam_id: examId,
          type: 'new_job',
          title: `${examForm.title} — Official Notification Released`,
          published_at: new Date().toISOString(),
        })

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
                  <Field label="Category">
                    <select className={INPUT_CLS} value={examForm.category_id} onChange={e => setExamField('category_id', e.target.value)}>
                      <option value="">— Select category —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Status" required>
                    <select className={INPUT_CLS} value={examForm.status} onChange={e => setExamField('status', e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </Field>
                  <Field label="Official Website (Apply Link)" required hint="This is where users click &ldquo;Apply Now&rdquo;">
                    <input className={INPUT_CLS} value={examForm.official_link} onChange={e => setExamField('official_link', e.target.value)} placeholder="https://ssc.gov.in" required />
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
                  <Field label="Application End (Last Date)" required>
                    <input type="date" className={INPUT_CLS} value={examForm.application_end} onChange={e => setExamField('application_end', e.target.value)} required />
                  </Field>
                  <Field label="Exam Date">
                    <input type="date" className={INPUT_CLS} value={examForm.exam_date} onChange={e => setExamField('exam_date', e.target.value)} />
                  </Field>
                </div>

                {/* Structured Content Tabbed Section Editor */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
                  <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider">
                    Notification Details &amp; Sections (Structured Content)
                  </label>
                  
                  {/* Tab Bar */}
                  <div className="flex flex-wrap gap-1.5 border-b border-gray-200 pb-2">
                    {[
                      { key: 'overview', label: 'Overview' },
                      { key: 'vacancy_details', label: 'Vacancies' },
                      { key: 'eligibility', label: 'Eligibility' },
                      { key: 'age_limit', label: 'Age Limit' },
                      { key: 'selection_process', label: 'Selection' },
                      { key: 'how_to_apply', label: 'How to Apply' },
                      { key: 'stipend_benefits', label: 'Stipend & Perks' },
                      { key: 'application_fee', label: 'App Fee' },
                      { key: 'important_dates_note', label: 'Notes' },
                    ].map(t => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveDetailsTab(t.key as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          activeDetailsTab === t.key
                            ? 'bg-[#1A3C6E] text-white shadow-sm'
                            : 'bg-white text-[#5B6880] hover:text-[#0F1C30] border border-gray-200'
                        }`}
                      >
                        {t.label}
                        {details[t.key as keyof ExamDetails]?.trim() && <span className="ml-1 text-[10px] opacity-75">✓</span>}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content Areas */}
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    {activeDetailsTab === 'overview' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Short introduction summary for the recruitment notice:</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.overview ?? ''}
                          onChange={e => setDetailField('overview', e.target.value)}
                          placeholder="Official recruitment notification released for SSC CGL 2026..."
                        />
                      </div>
                    )}

                    {activeDetailsTab === 'vacancy_details' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Vacancy distribution by post or category (one item per line for bullet points):</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.vacancy_details ?? ''}
                          onChange={e => setDetailField('vacancy_details', e.target.value)}
                          placeholder="• Assistant Section Officer: 1,200 posts&#10;• Inspector of Income Tax: 800 posts&#10;• Executive Assistant: 450 posts"
                        />
                      </div>
                    )}

                    {activeDetailsTab === 'eligibility' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Educational qualification &amp; eligibility conditions (one item per line):</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.eligibility ?? ''}
                          onChange={e => setDetailField('eligibility', e.target.value)}
                          placeholder="• Bachelor's Degree in any discipline from a recognized University&#10;• Computer Proficiency Certificate required for specific posts"
                        />
                      </div>
                    )}

                    {activeDetailsTab === 'age_limit' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Age limits, relaxation rules, and cutoff date:</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.age_limit ?? ''}
                          onChange={e => setDetailField('age_limit', e.target.value)}
                          placeholder="18 to 32 years as of 01-08-2026. Age relaxation: OBC - 3 years, SC/ST - 5 years, PwD - 10 years."
                        />
                      </div>
                    )}

                    {activeDetailsTab === 'selection_process' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Stages of selection process (one stage per line):</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.selection_process ?? ''}
                          onChange={e => setDetailField('selection_process', e.target.value)}
                          placeholder="• Tier 1: Computer Based Examination (Objective)&#10;• Tier 2: Subject-wise Computer Examination&#10;• Document Verification & Medical Exam"
                        />
                      </div>
                    )}

                    {activeDetailsTab === 'how_to_apply' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Step-by-step instructions to submit application online:</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.how_to_apply ?? ''}
                          onChange={e => setDetailField('how_to_apply', e.target.value)}
                          placeholder="1. Visit the official portal ssc.gov.in&#10;2. Complete One Time Registration (OTR)&#10;3. Fill application form & upload photo/signature&#10;4. Pay application fee and submit"
                        />
                      </div>
                    )}

                    {activeDetailsTab === 'stipend_benefits' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Salary grade, pay matrix level, allowance &amp; perks:</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.stipend_benefits ?? ''}
                          onChange={e => setDetailField('stipend_benefits', e.target.value)}
                          placeholder="Pay Level 7 (Rs. 44,900 to 1,42,400) + HRA, DA, Medical allowance as per Central Govt rules."
                        />
                      </div>
                    )}

                    {activeDetailsTab === 'application_fee' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Category-wise application fee and payment modes:</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.application_fee ?? ''}
                          onChange={e => setDetailField('application_fee', e.target.value)}
                          placeholder="General / OBC / EWS: Rs. 100&#10;SC / ST / PwD / Female: Exempted (Nil)"
                        />
                      </div>
                    )}

                    {activeDetailsTab === 'important_dates_note' && (
                      <div>
                        <p className="text-xs text-[#5B6880] mb-2 font-medium">Additional schedule notes or helpline details:</p>
                        <textarea
                          className={`${INPUT_CLS} min-h-28 resize-y`}
                          value={details.important_dates_note ?? ''}
                          onChange={e => setDetailField('important_dates_note', e.target.value)}
                          placeholder="Correction window will be open for 3 days after application closing date."
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Job Type Tags */}
                <Field label="Job Type Tags">
                  <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {jobTags.length === 0 ? (
                      <p className="text-xs text-[#5B6880] col-span-full">No tags found. Run the job_tags SQL first.</p>
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
                  <p className="text-xs text-[#5B6880] mt-1">{selectedJobTags.length} tag(s) selected</p>
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
