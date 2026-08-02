import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://frxkrxptwmrluhnsbepm.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyeGtyeHB0d21ybHVobnNiZXBtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMDkyMywiZXhwIjoyMTAwNzk2OTIzfQ.Vu2QQTqREhGktz6K2DUdSRNRTymevQo3qlHD1UO6OjY'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log('Inspecting existing job tags in database...')
  const { data: tags, error: fetchErr } = await supabase.from('job_tags').select('*')
  if (fetchErr) {
    console.error('Error fetching job_tags:', fetchErr)
    return
  }

  console.log(`Found ${tags?.length ?? 0} existing job tag(s):`, tags)

  console.log('Clearing exam_job_tags relationships...')
  const { error: relErr } = await supabase.from('exam_job_tags').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (relErr) {
    console.warn('Error clearing exam_job_tags:', relErr.message)
  } else {
    console.log('Cleared exam_job_tags.')
  }

  console.log('Deleting all rows from job_tags...')
  const { error: delErr } = await supabase.from('job_tags').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) {
    console.error('Error deleting job_tags:', delErr)
  } else {
    console.log('Successfully deleted all existing job tags!')
  }
}

main()
