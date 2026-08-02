'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/exams')
  }, [router])

  return (
    <div className="p-8 text-[#5B6880] text-sm">
      Redirecting to Content Listings…
    </div>
  )
}
