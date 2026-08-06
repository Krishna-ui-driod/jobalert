'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Category, State, ExamStatus } from '@/lib/types'
import Button from '@/components/ui/Button'
import { Plus, Trash2, Link, AlertTriangle, X } from 'lucide-react'
import { detectMalformedTable } from '@/lib/utils'

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
  
  // On-the-fly tags state for this post
  const [postTags, setPostTags] = useState<{ name: string; color: string }[]>([])
  const [tagInput, setTagInput] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  // Links
  const [examLinks, setExamLinks] = useState<{ id?: string; label: string; url: string }[]>([])
  const addLink = (label: string = '') => setExamLinks(prev => [...prev, { label, url: '' }])
  const removeLink = (i: number) => setExamLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: 'label' | 'url', val: string) =>
    setExamLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  const [form, setForm] = useState({
    title: exam?.title ?? '',
    slug: exam?.slug ?? '',
    category_id: exam?.category_id ?? '',
    description: exam?.description ?? '',
    application_end: exam?.application_end ?? '',
    auto_delete_at: exam?.auto_delete_at ?? '',
    status: exam?.status ?? 'upcoming' as ExamStatus,
    is_all_india: exam?.is_all_india ?? false,
  })


  useEffect(() => {
    supabase.from('states').select('*').order('name').then(({ data }) => setStates(data ?? []))
    if (exam) {
      supabase.from('exam_states').select('state_id').eq('exam_id', exam.id)
        .then(({ data }) => setSelectedStates(data?.map(r => r.state_id) ?? []))
      supabase.from('exam_job_tags').select('job_tags(name, color)').eq('exam_id', exam.id)
        .then(({ data }) => {
          const tags = (data ?? []).map((r: any) => r.job_tags).filter(Boolean)
          setPostTags(tags)
        })
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

  const [notAnnouncedAppEnd, setNotAnnouncedAppEnd] = useState(!exam?.application_end)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      ...form,
      description: (form.description ?? '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n'),
      department: null,
      qualification: null,
      age_limit: null,
      vacancy_count: null,
      official_link: null,
      details: null,
      category_id: form.category_id || null,
      exam_date: null,
      application_start: null,
      application_end: notAnnouncedAppEnd ? null : (form.application_end || null),
      auto_delete_at: form.auto_delete_at || null,
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

      // Sync exam_job_tags (upserting tags on-the-fly)
      if (examId) {
        await supabase.from('exam_job_tags').delete().eq('exam_id', examId)
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
              tagIds.map(job_tag_id => ({ exam_id: examId!, job_tag_id }))
            )
          }
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
        <Field label="Status" required>
          <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </Field>

        {/* Application End with Not Announced toggle (Text input for easy copy/paste) */}
        <Field label="Application End (Last Date)">
          <input
            type="text"
            className={inputCls}
            value={form.application_end}
            onChange={e => set('application_end', e.target.value)}
            disabled={notAnnouncedAppEnd}
            placeholder="e.g. 25-08-2026 or 25 Aug 2026"
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

        {/* Auto Delete Date */}
        <Field label="Auto Delete Date">
          <input
            type="text"
            className={inputCls}
            value={form.auto_delete_at}
            onChange={e => set('auto_delete_at', e.target.value)}
            placeholder="e.g. 2026-08-30 or 30 Aug 2026"
          />
          <p className="text-xs text-[#5B6880] mt-1">Optional — post will be automatically deleted on this date</p>
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
        {detectMalformedTable(form.description) && (
          <div className="mt-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-lg flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-amber-950">Table Formatting Warning: </span>
              This looks like a malformed table — check that every row has the same number of | columns and a separator row (|---|---|) is right after the header.
            </div>
          </div>
        )}
      </Field>

      {/* Additional Links */}
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
            className={`${inputCls} flex-1`}
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
