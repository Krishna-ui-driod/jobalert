'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Exam, Category } from '@/lib/types'
import ExamForm from '@/components/exams/ExamForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function EditExamPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('exams').select('*, categories(id,name,slug,icon)').eq('id', params.id).single(),
      supabase.from('categories').select('*'),
    ]).then(([examRes, catRes]) => {
      setExam(examRes.data)
      setCategories(catRes.data ?? [])
      setLoading(false)
    })
  }, [params.id])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-[#5B6880] text-sm">
        Loading exam…
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm">
          Exam not found. It may have been deleted.{' '}
          <Link href="/admin/exams" className="underline font-semibold">Back to Exams</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/exams"
          className="inline-flex items-center gap-2 text-[#5B6880] hover:text-[#1A3C6E] text-sm font-medium transition-colors mb-4"
        >
          <ArrowLeft size={15} /> Back to Exams
        </Link>
        <h1 className="text-[#0F1C30] font-bold text-2xl">Edit Exam</h1>
        <p className="text-[#5B6880] text-sm mt-1 font-medium">{exam.title}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <ExamForm
          exam={exam}
          categories={categories}
          onSuccess={() => router.push('/admin/exams')}
          onCancel={() => router.push('/admin/exams')}
        />
      </div>
    </div>
  )
}
