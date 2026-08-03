'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Category, State, ExamStatus, JobTag } from '@/lib/types'
import Button from '@/components/ui/Button'
import { Plus, Trash2, Link } from 'lucide-react'

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

  // Links
  const [examLinks, setExamLinks] = useState<{ id?: string; label: string; url: string }[]>([])
  const addLink = () => setExamLinks(prev => [...prev, { label: '', url: '' }])
  const removeLink = (i: number) => setExamLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: 'label' | 'url', val: string) =>
    setExamLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

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


  useEffect(() => {
    supabase.from('states').select('*').order('name').then(({ data }) => setStates(data ?? []))
    supabase.from('job_tags').select('*').order('name').then(({ data }) => setJobTags(data ?? []))
    if (exam) {
      supabase.from('exam_states').select('state_id').eq('exam_id', exam.id)
        .then(({ data }) => setSelectedStates(data?.map(r => r.state_id) ?? []))
      supabase.from('exam_job_tags').select('job_tag_id').eq('exam_id', exam.id)
        .then(({ data }) => setSelectedJobTags(data?.map(r => r.job_tag_id) ?? []))
      supabase.from('exam_links').select('id, label, url, display_order').eq('exam_id', exam.id).order('display_order')
        .then(({ data }) => setExamLinks(data?.map(r => ({ id: r.id, label: r.label, url: r.url })) ?? []))
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

  const [newTagModalOpen, setNewTagModalOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#1A3C6E')
  const [creatingTag, setCreatingTag] = useState(false)

  const [notAnnouncedAppEnd, setNotAnnouncedAppEnd] = useState(!exam?.application_end)
  const [pendingOfficialLink, setPendingOfficialLink] = useState(!exam?.official_link)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      ...form,
      vacancy_count: form.vacancy_count !== '' && form.vacancy_count !== null ? Number(form.vacancy_count) : null,
      details: null,
      category_id: form.category_id || null,
      exam_date: form.exam_date || null,
      application_start: form.application_start || null,
      application_end: notAnnouncedAppEnd ? null : (form.application_end || null),
      official_link: pendingOfficialLink ? null : (form.official_link || null),
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

      // Sync exam_links
      if (examId) {
        await supabase.from('exam_links').delete().eq('exam_id', examId)
        const validLinks = examLinks.filter(l => l.label.trim() && l.url.trim())
        if (validLinks.length > 0) {
          await supabase.from('exam_links').insert(
            validLinks.map((l, i) => ({ exam_id: examId!, label: l.label.trim(), url: l.url.trim(), display_order: i }))
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

  const COLOR_PRESETS = ['#1A3C6E', '#FF7A00', '#059669', '#7C3AED', '#DC2626', '#DB2777', '#0284C7', '#D97706']

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
        <Field label="Status" required>
          <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </Field>

        {/* Official Website Link with Not Released toggle */}
        <Field label="Official Website (Apply Link)">
          <input
            className={inputCls}
            value={form.official_link}
            onChange={e => set('official_link', e.target.value)}
            placeholder="https://ssc.gov.in"
            disabled={pendingOfficialLink}
          />
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer text-xs text-[#5B6880]">
            <input
              type="checkbox"
              checked={pendingOfficialLink}
              onChange={e => {
                setPendingOfficialLink(e.target.checked)
                if (e.target.checked) set('official_link', '')
              }}
              className="accent-[#1A3C6E]"
            />
            <span>Link pending / not announced yet</span>
          </label>
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

        {/* Application End with Not Announced toggle */}
        <Field label="Application End (Last Date)">
          <input
            type="date"
            className={inputCls}
            value={form.application_end}
            onChange={e => set('application_end', e.target.value)}
            disabled={notAnnouncedAppEnd}
          />
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer text-xs text-[#5B6880]">
            <input
              type="checkbox"
              checked={notAnnouncedAppEnd}
              onChange={e => {
                setNotAnnouncedAppEnd(e.target.checked)
                if (e.target.checked) set('application_end', '')
              }}
              className="accent-[#1A3C6E]"
            />
            <span>Not yet announced</span>
          </label>
        </Field>

        <Field label="Exam Date">
          <input type="date" className={inputCls} value={form.exam_date} onChange={e => set('exam_date', e.target.value)} />
        </Field>
        <Field label="PDF / Official Document">
          <input type="file" accept=".pdf,.doc,.docx" onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#EEF2F8] file:text-[#1A3C6E] hover:file:bg-[#1A3C6E] hover:file:text-white transition-all" />
        </Field>
      </div>

      {/* Description */}
      <Field label="Description / Notification Details">
        <p className="text-xs text-[#5B6880] mb-2">Write a full description of this exam/job notification. You can include eligibility, vacancies, selection process, fees, etc.</p>
        <textarea
          className={`${inputCls} min-h-48 resize-y`}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder={`Official recruitment notification released by SSC for CGL 2026. Eligible candidates can apply online from ssc.gov.in...\n\nEligibility: Bachelor's degree\nVacancies: 17,727 posts\nFee: General Rs.100 | SC/ST Free`}
        />
      </Field>

      {/* Additional Links */}
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
        <p className="text-xs text-[#5B6880]">Add supplementary links (Official PDF, Syllabus, Apply Online, etc.). These appear on the public exam page below the Apply button.</p>
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
                  placeholder="Label (e.g. Official PDF, Syllabus)"
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
