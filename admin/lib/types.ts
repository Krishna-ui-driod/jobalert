// ─── TypeScript types matching the Phase 1 database schema ───────────────────

export type ExamStatus = 'upcoming' | 'active' | 'closed' | 'result_declared'
export type NotificationType = 'new_job' | 'result' | 'admit_card' | 'answer_key' | 'syllabus'
export type AdminRole = 'editor' | 'super_admin'
export type AlertType = 'email' | 'push'

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
}

export interface JobTag {
  id: string
  name: string
  slug: string
  color: string
}

export interface State {
  id: string
  name: string
  code: string
}

export interface ExamDetails {
  overview?: string
  vacancy_details?: string
  eligibility?: string
  age_limit?: string
  stipend_benefits?: string
  selection_process?: string
  how_to_apply?: string
  application_fee?: string
  important_dates_note?: string
}

export interface Exam {
  id: string
  title: string
  slug: string
  category_id: string | null
  department: string | null
  description: string | null
  details?: ExamDetails | null
  qualification: string | null
  age_limit: string | null
  application_start: string | null
  application_end: string | null
  exam_date: string | null
  status: ExamStatus
  official_link: string | null
  is_all_india: boolean
  vacancy_count: number | null
  created_at: string
  updated_at: string
  categories?: Category | null
  exam_job_tags?: { job_tag_id: string; job_tags: JobTag | null }[]
}

export interface Notification {
  id: string
  exam_id: string | null
  type: NotificationType
  title: string
  pdf_url: string | null
  published_at: string
  exams?: { title: string } | null
}

export interface Subscription {
  id: string
  user_id: string
  category_id: string | null
  exam_id: string | null
  alert_type: AlertType
  categories?: { name: string } | null
  exams?: { title: string } | null
}

export interface Admin {
  user_id: string
  role: AdminRole
  created_at: string
}

// ─── Status display helpers ───────────────────────────────────────────────────
export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  closed: 'Closed',
  result_declared: 'Result Declared',
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_job: 'New Job',
  result: 'Result',
  admit_card: 'Admit Card',
  answer_key: 'Answer Key',
  syllabus: 'Syllabus',
}
