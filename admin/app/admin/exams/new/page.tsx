'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types'
import ExamForm from '@/components/exams/ExamForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NewExamPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => setCategories(data ?? []))
  }, [])

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/exams"
          className="inline-flex items-center gap-2 text-[#5B6880] hover:text-[#1A3C6E] text-sm font-medium transition-colors mb-4"
        >
          <ArrowLeft size={15} /> Back to Exams
        </Link>
        <h1 className="text-[#0F1C30] font-bold text-2xl">Add New Exam</h1>
        <p className="text-[#5B6880] text-sm mt-1">Fill in all the details to create a new exam entry.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <ExamForm
          exam={null}
          categories={categories}
          onSuccess={() => router.push('/admin/exams')}
          onCancel={() => router.push('/admin/exams')}
        />
      </div>
    </div>
  )
}
