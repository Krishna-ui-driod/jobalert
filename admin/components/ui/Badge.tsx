import { ExamStatus, NotificationType } from '@/lib/types'
import { cn } from '@/lib/utils'

const examStatusStyles: Record<ExamStatus, string> = {
  upcoming:         'bg-blue-100 text-blue-700 border-blue-200',
  active:           'bg-green-100 text-green-700 border-green-200',
  closed:           'bg-gray-100 text-gray-600 border-gray-200',
  result_declared:  'bg-purple-100 text-purple-700 border-purple-200',
}

const notifTypeStyles: Record<NotificationType, string> = {
  new_job:    'bg-blue-100 text-blue-700 border-blue-200',
  result:     'bg-green-100 text-green-700 border-green-200',
  admit_card: 'bg-orange-100 text-orange-700 border-orange-200',
  answer_key: 'bg-purple-100 text-purple-700 border-purple-200',
  syllabus:   'bg-teal-100 text-teal-700 border-teal-200',
}

const examStatusLabels: Record<ExamStatus, string> = {
  upcoming:         'Upcoming',
  active:           'Active',
  closed:           'Closed',
  result_declared:  'Result Declared',
}

const notifTypeLabels: Record<NotificationType, string> = {
  new_job:    'New Job',
  result:     'Result',
  admit_card: 'Admit Card',
  answer_key: 'Answer Key',
  syllabus:   'Syllabus',
}

interface BadgeProps {
  status?: ExamStatus
  type?: NotificationType
  className?: string
}

export default function Badge({ status, type, className }: BadgeProps) {
  const style = status
    ? examStatusStyles[status]
    : type ? notifTypeStyles[type] : 'bg-gray-100 text-gray-600 border-gray-200'
  const label = status
    ? examStatusLabels[status]
    : type ? notifTypeLabels[type] : '—'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
        style,
        className
      )}
    >
      {label}
    </span>
  )
}
