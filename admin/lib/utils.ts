// lib/utils.ts — cn() helper & markdown table sanitization helpers
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Detects if Markdown text contains malformed table patterns.
 * Returns true if table-like lines exist but fail GFM table specifications.
 */
export function detectMalformedTable(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string' || !text.includes('|')) {
    return false
  }

  const lines = text.split('\n')
  let i = 0

  // Regex to match GFM table delimiter row (e.g. |---|---| or | --- | :---: | or --- | ---)
  const delimiterRegex = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?$/

  while (i < lines.length) {
    const trimmedLine = lines[i].trim()

    // Check if line contains '|' and has actual content
    if (trimmedLine.includes('|') && trimmedLine.length > 1) {
      const block: string[] = []

      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim().length > 1) {
        block.push(lines[i].trim())
        i++
      }

      // If 2 or more consecutive lines contain '|', check validity
      if (block.length >= 2) {
        // 1. Check if index 1 (second line of block) is a valid delimiter separator row
        const hasDelimiter = delimiterRegex.test(block[1])

        if (!hasDelimiter) {
          return true
        }

        // Helper to count pipe-separated columns in a row
        const getColumnCount = (line: string) => {
          const normalized = line.replace(/^\|/, '').replace(/\|$/, '')
          return normalized.split('|').length
        }

        const headerCols = getColumnCount(block[0])
        const delimiterCols = getColumnCount(block[1])

        if (headerCols !== delimiterCols) {
          return true
        }

        // Check each data row (index 2 onwards)
        for (let r = 2; r < block.length; r++) {
          const rowCols = getColumnCount(block[r])
          if (rowCols !== headerCols) {
            return true
          }
        }
      }
    } else {
      i++
    }
  }

  return false
}
