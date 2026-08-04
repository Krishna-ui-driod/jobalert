'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Notification, NotificationType } from '@/lib/types'
import Button from '@/components/ui/Button'
import { Send, Search } from 'lucide-react'

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'new_job',    label: 'New Job / Recruitment' },
  { value: 'result',     label: 'Result' },
  { value: 'admit_card', label: 'Admit Card' },
  { value: 'answer_key', label: 'Answer Key' },
  { value: 'syllabus',   label: 'Syllabus' },
]

interface NotificationFormProps {
  notification?: Notification | null
  onSuccess: () => void
  onCancel?: () => void
}

export default function NotificationForm({ notification, onSuccess, onCancel }: NotificationFormProps) {
  const supabase = createClient()
  const [exams, setExams] = useState<Pick<Exam, 'id' | 'title'>[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Pick<Exam, 'id' | 'title'> | null>(
    notification?.exam_id ? { id: notification.exam_id, title: (notification as any).exams?.title ?? 'Linked Exam' } : null
  )
  const [type, setType] = useState<NotificationType>(notification?.type ?? 'new_job')
  const [title, setTitle] = useState(notification?.title ?? '')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(notification?.pdf_url ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase
      .from('exams')
      .select('id, title')
      .order('title')
      .then(({ data }) => setExams(data ?? []))
  }, [])

  const filteredExams = exams.filter(e =>
    e.title.toLowerCase().includes(examSearch.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      let pdf_url: string | null = currentPdfUrl

      // Upload PDF if provided
      if (pdfFile) {
        const path = `notifications/${Date.now()}-${pdfFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('pdfs')
          .upload(path, pdfFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(path)
        pdf_url = urlData.publicUrl
      }

      if (notification?.id) {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            exam_id: selectedExam?.id ?? null,
            type,
            title,
            pdf_url,
          })
          .eq('id', notification.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('notifications').insert({
          exam_id: selectedExam?.id ?? null,
          type,
          title,
          pdf_url,
          published_at: new Date().toISOString(),
        })
        if (insertError) throw insertError
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onSuccess()
    } catch (err: any) {
      setError(err.message ?? 'Failed to save notification')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/10 transition-all'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
          ✓ Notification posted successfully!
        </div>
      )}

      {/* Exam search */}
      <div>
        <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1.5">
          Linked Exam <span className="text-gray-400 font-normal normal-case">(optional)</span>
        </label>
        <div className="relative">
          {selectedExam ? (
            <div className="flex items-center gap-2 border border-[#1A3C6E] bg-[#EEF2F8] rounded-lg px-3 py-2">
              <span className="text-sm text-[#0F1C30] font-medium flex-1 truncate">{selectedExam.title}</span>
              <button
                type="button"
                onClick={() => { setSelectedExam(null); setExamSearch('') }}
                className="text-gray-400 hover:text-red-500 text-xs font-bold"
              >✕</button>
            </div>
          ) : (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={examSearch}
                onChange={e => { setExamSearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="Search exam…"
                className={`${inputCls} pl-9`}
              />
              {showDropdown && filteredExams.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredExams.slice(0, 20).map(e => (
                    <button
                      key={e.id}
                      type="button"
                      onMouseDown={() => { setSelectedExam(e); setExamSearch(''); setShowDropdown(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-[#0F1C30] hover:bg-[#EEF2F8] transition-colors border-b border-gray-50 last:border-0"
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1.5">
          Notification Type <span className="text-red-500">*</span>
        </label>
        <select
          value={type}
          onChange={e => setType(e.target.value as NotificationType)}
          className={inputCls}
          required
        >
          {NOTIFICATION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          placeholder="SSC CGL 2025 Result Declared"
          className={inputCls}
        />
      </div>

      {/* PDF Upload */}
      <div>
        <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1.5">
          PDF Attachment <span className="text-gray-400 font-normal normal-case">(optional)</span>
        </label>
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#EEF2F8] file:text-[#1A3C6E] hover:file:bg-[#1A3C6E] hover:file:text-white transition-all"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading} className="justify-center">
          <Send size={15} />
          {loading ? 'Saving…' : notification?.id ? 'Update Notification' : 'Post Notification'}
        </Button>
      </div>
    </form>
  )
}
