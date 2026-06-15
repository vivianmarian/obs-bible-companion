'use strict'

/**
 * Searches bible data array for verses matching a query string.
 * Matching is case-insensitive and checks both the verse name (reference)
 * and the verse text content.
 *
 * @param {string} query - The search string entered by the operator
 * @param {Array<{name: string, verse: string, ari: string}>} bibleData - The loaded translation array
 * @returns {Array<{name: string, verse: string, ari: string}>} Matching verse objects (max 50)
 */
export function searchBible(query, bibleData) {
  if (!query || typeof query !== 'string') return []
  if (!Array.isArray(bibleData) || bibleData.length === 0) return []

  const q = query.trim().toLowerCase()
  if (q.length === 0) return []

  const results = []
  for (let i = 0; i < bibleData.length; i++) {
    const entry = bibleData[i]
    if (!entry || typeof entry.name !== 'string' || typeof entry.verse !== 'string') continue

    if (entry.name.toLowerCase().includes(q) || entry.verse.toLowerCase().includes(q)) {
      results.push({ ...entry, __index: i })
      if (results.length >= 50) break
    }
  }
  return results
}

/**
 * Finds the array index of a verse by its reference string (e.g. 'John 3:16').
 * Matching is case-insensitive and trims whitespace.
 *
 * @param {string} reference - The verse reference to look up
 * @param {Array<{name: string, verse: string, ari: string}>} bibleData - The loaded translation array
 * @returns {number} The index of the matching verse, or -1 if not found
 */
export function findVerseIndexByReference(reference, bibleData) {
  if (!reference || typeof reference !== 'string') return -1
  if (!Array.isArray(bibleData) || bibleData.length === 0) return -1

  const ref = reference.trim().toLowerCase()
  for (let i = 0; i < bibleData.length; i++) {
    const entry = bibleData[i]
    if (entry && typeof entry.name === 'string' && entry.name.trim().toLowerCase() === ref) {
      return i
    }
  }
  return -1
}
