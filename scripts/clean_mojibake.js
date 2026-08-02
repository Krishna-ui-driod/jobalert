import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://frxkrxptwmrluhnsbepm.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyeGtyeHB0d21ybHVobnNiZXBtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMDkyMywiZXhwIjoyMTAwNzk2OTIzfQ.Vu2QQTqREhGktz6K2DUdSRNRTymevQo3qlHD1UO6OjY'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function cleanString(text) {
  if (!text || typeof text !== 'string') return text
  let s = text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\uFFFD\s*\./g, '')
    .replace(/\uFFFD/g, '')
    .replace(/•\s*\./g, '')
    .replace(/•\s*•/g, '•')
    .trim()

  const rawLines = s.split('\n')
  const cleanedLines = []

  for (let line of rawLines) {
    let l = line.trim()
    l = l.replace(/^•\s*\./, '').replace(/•\s*\.$/, '').replace(/•\s*\./g, '').trim()
    if (l) cleanedLines.push(l)
  }

  return cleanedLines.join('\n')
}

async function main() {
  console.log('Fetching all exams for mojibake cleanup...')
  const { data: exams, error } = await supabase.from('exams').select('*')
  if (error) {
    console.error('Error fetching exams:', error)
    return
  }

  console.log(`Found ${exams.length} exams. Cleaning description & details fields...`)

  let updatedCount = 0

  for (const exam of exams) {
    let updated = false
    let newDesc = exam.description

    if (exam.description) {
      const cleanedDesc = cleanString(exam.description)
      if (cleanedDesc !== exam.description) {
        newDesc = cleanedDesc
        updated = true
      }
    }

    let newDetails = exam.details
    if (exam.details && typeof exam.details === 'object' && !Array.isArray(exam.details)) {
      newDetails = { ...exam.details }
      for (const [key, val] of Object.entries(newDetails)) {
        if (typeof val === 'string') {
          const cleanedVal = cleanString(val)
          if (cleanedVal !== val) {
            newDetails[key] = cleanedVal
            updated = true
          }
        }
      }
    }

    if (updated) {
      console.log(`Updating exam "${exam.title}" (${exam.id})...`)
      const { error: updateErr } = await supabase
        .from('exams')
        .update({ description: newDesc, details: newDetails })
        .eq('id', exam.id)

      if (updateErr) {
        console.error(`Failed to update exam ${exam.id}:`, updateErr)
      } else {
        updatedCount++
      }
    }
  }

  console.log(`Cleanup finished! Successfully updated ${updatedCount} exam records.`)
}

main()
