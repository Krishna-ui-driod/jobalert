'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Category, State, ExamStatus, JobTag, ExamDetails } from '@/lib/types'
import Button from '@/components/ui/Button'

interface ExamFormProps {
  exam: Exam | null
  categories: Category[]
  onSuccess: () => void
  onCancel: () => void
}

const STATUSES: ExamStatus[] = ['upcoming', 'active', 'closed', 'result_declared']

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Field label wrapper — MUST be outside ExamForm to avoid remounting on every keystroke
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/10 transition-all"

export default function ExamForm({ exam, categories, onSuccess, onCancel }: ExamFormProps) {
  const supabase = createClient()
  const [states, setStates] = useState<State[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [jobTags, setJobTags] = useState<JobTag[]>([])
  const [selectedJobTags, setSelectedJobTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    title: exam?.title ?? '',
    slug: exam?.slug ?? '',
    category_id: exam?.category_id ?? '',
    department: exam?.department ?? '',
    description: exam?.description ?? '',
    qualification: exam?.qualification ?? '',
    age_limit: exam?.age_limit ?? '',
    application_start: exam?.application_start ?? '',
    application_end: exam?.application_end ?? '',
    exam_date: exam?.exam_date ?? '',
    status: exam?.status ?? 'upcoming' as ExamStatus,
    official_link: exam?.official_link ?? '',
    is_all_india: exam?.is_all_india ?? false,
    vacancy_count: exam?.vacancy_count ?? '',
  })

  const [details, setDetails] = useState<ExamDetails>({
    overview: exam?.details?.overview ?? exam?.description ?? '',
    vacancy_details: exam?.details?.vacancy_details ?? '',
    eligibility: exam?.details?.eligibility ?? '',
    age_limit: exam?.details?.age_limit ?? '',
    stipend_benefits: exam?.details?.stipend_benefits ?? '',
    selection_process: exam?.details?.selection_process ?? '',
    how_to_apply: exam?.details?.how_to_apply ?? '',
    application_fee: exam?.details?.application_fee ?? '',
    important_dates_note: exam?.details?.important_dates_note ?? '',
  })

  type DetailsTab = 'overview' | 'vacancy_details' | 'eligibility' | 'age_limit' | 'stipend_benefits' | 'selection_process' | 'how_to_apply' | 'application_fee' | 'important_dates_note'
  const [activeDetailsTab, setActiveDetailsTab] = useState<DetailsTab>('overview')

  const setDetailField = (key: keyof ExamDetails, value: string) => {
    setDetails(prev => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    supabase.from('states').select('*').order('name').then(({ data }) => setStates(data ?? []))
    supabase.from('job_tags').select('*').order('name').then(({ data }) => setJobTags(data ?? []))
    if (exam) {
      supabase.from('exam_states').select('state_id').eq('exam_id', exam.id)
        .then(({ data }) => setSelectedStates(data?.map(r => r.state_id) ?? []))
      supabase.from('exam_job_tags').select('job_tag_id').eq('exam_id', exam.id)
        .then(({ data }) => setSelectedJobTags(data?.map(r => r.job_tag_id) ?? []))
    }
  }, [exam?.id])

  const set = (field: string, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleTitleChange = (v: string) => {
    setForm(f => ({ ...f, title: v, slug: exam ? f.slug : slugify(v) }))
  }

  const toggleState = (id: string) =>
    setSelectedStates(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const toggleJobTag = (id: string) =>
    setSelectedJobTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!form.application_end) {
      setError('Please select "Last Date to Apply" before saving.')
      setLoading(false)
      return
    }

    if (!form.official_link || !form.official_link.trim()) {
      setError('Please enter the "Official Website (Apply Link)" before saving.')
      setLoading(false)
      return
    }

    const payload = {
      ...form,
      vacancy_count: form.vacancy_count !== '' && form.vacancy_count !== null ? Number(form.vacancy_count) : null,
      description: details.overview || form.description,
      details,
      category_id: form.category_id || null,
      exam_date: form.exam_date || null,
      application_start: form.application_start || null,
      application_end: form.application_end || null,
    }

    try {
      let examId = exam?.id
      if (exam) {
        const { error } = await supabase.from('exams').update(payload).eq('id', exam.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('exams').insert(payload).select().single()
        if (error) throw error
        examId = data.id
      }

      // Sync exam_states (skip if all-india)
      if (examId) {
        await supabase.from('exam_states').delete().eq('exam_id', examId)
        if (!form.is_all_india && selectedStates.length > 0) {
          await supabase.from('exam_states').insert(
            selectedStates.map(state_id => ({ exam_id: examId!, state_id }))
          )
        }
      }

      // Sync exam_job_tags
      if (examId) {
        await supabase.from('exam_job_tags').delete().eq('exam_id', examId)
        if (selectedJobTags.length > 0) {
          await supabase.from('exam_job_tags').insert(
            selectedJobTags.map(job_tag_id => ({ exam_id: examId!, job_tag_id }))
          )
        }
      }

      // PDF upload (notifications)
      if (pdfFile && examId) {
        const ext = pdfFile.name.split('.').pop()
        const path = `exams/${examId}/${Date.now()}.${ext}`
        await supabase.storage.from('pdfs').upload(path, pdfFile, { upsert: true })
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = INPUT_CLS

  const tabs: { key: DetailsTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'vacancy_details', label: 'Vacancies' },
    { key: 'eligibility', label: 'Eligibility' },
    { key: 'age_limit', label: 'Age Limit' },
    { key: 'selection_process', label: 'Selection' },
    { key: 'how_to_apply', label: 'How to Apply' },
    { key: 'stipend_benefits', label: 'Stipend & Perks' },
    { key: 'application_fee', label: 'App Fee' },
    { key: 'important_dates_note', label: 'Notes' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title" required>
          <input className={inputCls} value={form.title} onChange={e => handleTitleChange(e.target.value)} required />
        </Field>
        <Field label="Slug" required>
          <input className={inputCls} value={form.slug} onChange={e => set('slug', e.target.value)} required placeholder="ssc-cgl-2026" />
        </Field>
        <Field label="Department">
          <input className={inputCls} value={form.department} onChange={e => set('department', e.target.value)} placeholder="Staff Selection Commission" />
        </Field>
        <Field label="Category">
          <select className={inputCls} value={form.category_id} onChange={e => set('category_id', e.target.value)}>
            <option value="">— Select category —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Status" required>
          <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Official Website (Apply Link)" required>
          <input className={inputCls} value={form.official_link} onChange={e => set('official_link', e.target.value)} placeholder="https://ssc.gov.in" required />
          <p className="text-xs text-[#5B6880] mt-1">Required: Official URL for &ldquo;Apply Now&rdquo;</p>
        </Field>
        <Field label="Qualification">
          <input className={inputCls} value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="Graduation" />
        </Field>
        <Field label="Age Limit Summary">
          <input className={inputCls} value={form.age_limit} onChange={e => set('age_limit', e.target.value)} placeholder="18–32 years" />
        </Field>
        <Field label="Total Posts / Vacancies">
          <input type="number" min="0" className={inputCls} value={form.vacancy_count} onChange={e => set('vacancy_count', e.target.value)} placeholder="e.g. 17727 (Leave empty if not announced)" />
        </Field>
        <Field label="Application Start">
          <input type="date" className={inputCls} value={form.application_start} onChange={e => set('application_start', e.target.value)} />
        </Field>
        <Field label="Application End (Last Date)" required>
          <input type="date" className={inputCls} value={form.application_end} onChange={e => set('application_end', e.target.value)} required />
        </Field>
        <Field label="Exam Date">
          <input type="date" className={inputCls} value={form.exam_date} onChange={e => set('exam_date', e.target.value)} />
        </Field>
        <Field label="PDF / Official Document">
          <input type="file" accept=".pdf,.doc,.docx" onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#EEF2F8] file:text-[#1A3C6E] hover:file:bg-[#1A3C6E] hover:file:text-white transition-all" />
        </Field>
      </div>

      {/* Structured Content Tabbed Section Editor */}
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
        <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider">
          Notification Details &amp; Sections (Structured Content)
        </label>
        
        {/* Tab Bar */}
        <div className="flex flex-wrap gap-1.5 border-b border-gray-200 pb-2">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveDetailsTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeDetailsTab === t.key
                  ? 'bg-[#1A3C6E] text-white shadow-sm'
                  : 'bg-white text-[#5B6880] hover:text-[#0F1C30] border border-gray-200'
              }`}
            >
              {t.label}
              {details[t.key]?.trim() && <span className="ml-1 text-[10px] opacity-75">✓</span>}
            </button>
          ))}
        </div>

        {/* Tab Content Areas */}
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          {activeDetailsTab === 'overview' && (
            <div>
              <p className="text-xs text-[#5B6880] mb-2 font-medium">Short introduction summary for the recruitment notice:</p>
              <textarea
                className={`${inputCls} min-h-28 resize-y`}
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
                className={`${inputCls} min-h-28 resize-y`}
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
                className={`${inputCls} min-h-28 resize-y`}
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
                className={`${inputCls} min-h-28 resize-y`}
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
                className={`${inputCls} min-h-28 resize-y`}
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
                className={`${inputCls} min-h-28 resize-y`}
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
                className={`${inputCls} min-h-28 resize-y`}
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
                className={`${inputCls} min-h-28 resize-y`}
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
                className={`${inputCls} min-h-28 resize-y`}
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
            <p className="text-xs text-[#5B6880] col-span-full">No tags found. Run the SQL migration first.</p>
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
            checked={form.is_all_india}
            onChange={e => set('is_all_india', e.target.checked)}
            className="accent-[#1A3C6E] w-4 h-4"
          />
          <div>
            <p className="text-sm font-semibold text-[#0F1C30]">All India / Central Govt exam</p>
            <p className="text-xs text-[#5B6880]">Check this if the exam is not limited to specific states</p>
          </div>
        </label>
      </Field>

      {/* States multi-select — hidden when is_all_india */}
      {!form.is_all_india && (
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

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : exam ? 'Update Exam' : 'Create Exam'}
        </Button>
      </div>
    </form>
  )
}
