'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Share2, Check, AlertCircle } from 'lucide-react'

interface SocialLinksFormProps {
  initialData?: {
    twitter_url?: string
    youtube_url?: string
    instagram_url?: string
    facebook_url?: string
    telegram_url?: string
    whatsapp_url?: string
  } | null
}

export default function SocialLinksForm({ initialData }: SocialLinksFormProps) {
  const supabase = createClient()
  const [form, setForm] = useState({
    twitter_url: initialData?.twitter_url ?? 'https://x.com/jobalertin',
    youtube_url: initialData?.youtube_url ?? 'https://youtube.com/@jobalertin',
    instagram_url: initialData?.instagram_url ?? 'https://instagram.com/jobalertin',
    facebook_url: initialData?.facebook_url ?? 'https://facebook.com/jobalertin',
    telegram_url: initialData?.telegram_url ?? 'https://t.me/jobalertin',
    whatsapp_url: initialData?.whatsapp_url ?? 'https://chat.whatsapp.com/jobalertin',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: upsertErr } = await supabase
        .from('site_settings')
        .upsert({
          id: 'default',
          ...form,
          updated_at: new Date().toISOString(),
        })

      if (upsertErr) throw upsertErr
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#0F1C30] outline-none focus:border-[#1A3C6E] focus:ring-2 focus:ring-[#1A3C6E]/10 transition-all"

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-bold text-[#0F1C30] text-sm flex items-center gap-2 mb-4">
        <Share2 size={15} className="text-[#FF7A00]" /> Social &amp; Community Links (Public Header &amp; Footer)
      </h2>
      <p className="text-xs text-[#5B6880] mb-5">
        Configure official WhatsApp, Telegram, and social channel links displayed on the public website header and footer.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3.5 py-2.5 rounded-lg mb-4 flex items-center gap-2 font-medium">
          <Check size={14} /> Community &amp; social links saved successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#E8F7EF] p-3 rounded-lg border border-[#1F9D55]/20">
            <label className="block text-xs font-bold text-[#1F9D55] uppercase tracking-wider mb-1">
              WhatsApp Channel / Group URL
            </label>
            <input
              type="url"
              className={inputCls}
              value={form.whatsapp_url}
              onChange={e => setForm(f => ({ ...f, whatsapp_url: e.target.value }))}
              placeholder="https://chat.whatsapp.com/... or https://wa.me/..."
            />
          </div>

          <div className="bg-[#EEF2F8] p-3 rounded-lg border border-[#1A3C6E]/20">
            <label className="block text-xs font-bold text-[#1A3C6E] uppercase tracking-wider mb-1">
              Telegram Channel URL
            </label>
            <input
              type="url"
              className={inputCls}
              value={form.telegram_url}
              onChange={e => setForm(f => ({ ...f, telegram_url: e.target.value }))}
              placeholder="https://t.me/yourchannel"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1">
              Twitter / X URL
            </label>
            <input
              type="url"
              className={inputCls}
              value={form.twitter_url}
              onChange={e => setForm(f => ({ ...f, twitter_url: e.target.value }))}
              placeholder="https://x.com/yourhandle"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1">
              YouTube Channel URL
            </label>
            <input
              type="url"
              className={inputCls}
              value={form.youtube_url}
              onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
              placeholder="https://youtube.com/@yourchannel"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1">
              Instagram Profile URL
            </label>
            <input
              type="url"
              className={inputCls}
              value={form.instagram_url}
              onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))}
              placeholder="https://instagram.com/yourprofile"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-1">
              Facebook Page URL
            </label>
            <input
              type="url"
              className={inputCls}
              value={form.facebook_url}
              onChange={e => setForm(f => ({ ...f, facebook_url: e.target.value }))}
              placeholder="https://facebook.com/yourpage"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#FF7A00] hover:bg-[#E86E00] text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors shadow-md disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Links'}
          </button>
        </div>
      </form>
    </div>
  )
}
