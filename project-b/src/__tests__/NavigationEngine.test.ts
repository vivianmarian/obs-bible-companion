/**
 * NavigationEngine.test.ts
 *
 * Tests the full state machine in isolation.
 * Uses an in-memory BibleStructureData fixture — no filesystem access.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { NavigationEngine, BAND_SIZE, type Testament } from '../navigation/NavigationEngine.js'
import type { BibleStructureData } from '../navigation/BibleStructure.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal structure with:
 *   - Genesis (OT, index 1): chapter 1 = 31 verses, chapter 2 = 25 verses
 *   - Psalms  (OT, index 19): chapters 1–150 = 10 verses each
 *     (150 chapters forces CHAPTER_RANGE_SELECT; >10 verses forces VERSE_RANGE_SELECT)
 *   - John    (NT, index 43): chapter 3 = 36 verses
 *   - Jude    (NT, index 65): chapter 1 = 25 verses
 */
function makeStructure(): BibleStructureData {
  // Build Psalms with 150 chapters, each 10 verses (exactly BAND_SIZE — no VERSE_RANGE)
  const psalmChapters: Record<string, number> = {}
  for (let i = 1; i <= 150; i++) psalmChapters[String(i)] = 10

  // Build a book with > BAND_SIZE verses in one chapter to trigger VERSE_RANGE_SELECT
  // John ch 3 = 36 verses (> 10 = BAND_SIZE) ✓

  return {
    books: {
      Genesis: { testament: 'Old', index: 1,  chapters: { '1': 31, '2': 25 } },
      Psalms:  { testament: 'Old', index: 19, chapters: psalmChapters },
      John:    { testament: 'New', index: 43, chapters: { '3': 36 } },
      Jude:    { testament: 'New', index: 65, chapters: { '1': 25 } },
    },
    translations: ['KJV'],
    totalVerses: 0,
    generatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let engine: NavigationEngine

beforeEach(() => {
  engine = new NavigationEngine(makeStructure())
})

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('starts at TESTAMENT_SELECT', () => {
    expect(engine.getState().stage).toBe('TESTAMENT_SELECT')
  })

  it('has no selections at start', () => {
    const s = engine.getState()
    expect(s.selectedTestament).toBeNull()
    expect(s.selectedBook).toBeNull()
    expect(s.selectedChapter).toBeNull()
    expect(s.selectedVerse).toBeNull()
    expect(s.reference).toBeNull()
  })

  it('offers Old Testament and New Testament options', () => {
    const options = engine.getState().options
    expect(options).toHaveLength(2)
    expect(options.map(o => o.value)).toEqual(['Old', 'New'])
  })
})

// ---------------------------------------------------------------------------
// TESTAMENT_SELECT → BOOK_SELECT
// ---------------------------------------------------------------------------

describe('selectTestament', () => {
  it('moves to BOOK_SELECT after selecting Old', () => {
    const s = engine.selectTestament('Old')
    expect(s.stage).toBe('BOOK_SELECT')
    expect(s.selectedTestament).toBe('Old')
  })

  it('moves to BOOK_SELECT after selecting New', () => {
    const s = engine.selectTestament('New')
    expect(s.stage).toBe('BOOK_SELECT')
    expect(s.selectedTestament).toBe('New')
  })

  it('only lists Old Testament books when Old is selected', () => {
    engine.selectTestament('Old')
    const books = engine.getState().options.map(o => o.value)
    expect(books).toContain('Genesis')
    expect(books).toContain('Psalms')
    expect(books).not.toContain('John')
    expect(books).not.toContain('Jude')
  })

  it('only lists New Testament books when New is selected', () => {
    engine.selectTestament('New')
    const books = engine.getState().options.map(o => o.value)
    expect(books).toContain('John')
    expect(books).toContain('Jude')
    expect(books).not.toContain('Genesis')
  })

  it('books are sorted by canonical index', () => {
    engine.selectTestament('Old')
    const books = engine.getState().options.map(o => o.value)
    const genesisIdx = books.indexOf('Genesis')
    const psalmsIdx  = books.indexOf('Psalms')
    expect(genesisIdx).toBeLessThan(psalmsIdx)
  })

  it('clears all downstream selections when testament is re-selected', () => {
    engine.selectTestament('Old')
    engine.selectBook('Psalms')      // 150 chapters -> CHAPTER_RANGE_SELECT
    engine.selectChapterRange(0)      // band 0 -> CHAPTER_SELECT
    engine.selectChapter('1')         // Psalms 1 = 10 verses -> VERSE_SELECT (no range)
    engine.selectVerse('1')           // -> READY_TO_DISPLAY
    // Re-select testament — all downstream must clear
    engine.selectTestament('New')
    const s = engine.getState()
    expect(s.selectedBook).toBeNull()
    expect(s.selectedChapter).toBeNull()
    expect(s.selectedVerse).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// BOOK_SELECT → CHAPTER_SELECT (short book: Genesis, 2 chapters ≤ BAND_SIZE)
// ---------------------------------------------------------------------------

describe('selectBook — short book (no chapter range)', () => {
  beforeEach(() => { engine.selectTestament('Old') })

  it('moves to CHAPTER_SELECT when book has <= BAND_SIZE chapters', () => {
    const s = engine.selectBook('Genesis')
    expect(s.stage).toBe('CHAPTER_SELECT')
  })

  it('lists all chapters for Genesis', () => {
    engine.selectBook('Genesis')
    const options = engine.getState().options
    expect(options.map(o => o.value)).toEqual(['1', '2'])
  })

  it('throws when a wrong-testament book is selected', () => {
    expect(() => engine.selectBook('John')).toThrow(/New Testament/)
  })

  it('throws when an unknown book name is given', () => {
    expect(() => engine.selectBook('Hezekiah')).toThrow(/not found/)
  })
})

// ---------------------------------------------------------------------------
// BOOK_SELECT → CHAPTER_RANGE_SELECT (long book: Psalms, 150 chapters > BAND_SIZE)
// ---------------------------------------------------------------------------

describe('selectBook — long book (chapter range)', () => {
  beforeEach(() => { engine.selectTestament('Old') })

  it('moves to CHAPTER_RANGE_SELECT when book has > BAND_SIZE chapters', () => {
    const s = engine.selectBook('Psalms')
    expect(s.stage).toBe('CHAPTER_RANGE_SELECT')
  })

  it('produces the correct number of bands for 150 chapters', () => {
    engine.selectBook('Psalms')
    const options = engine.getState().options
    // 150 / 10 = exactly 15 bands
    expect(options).toHaveLength(15)
  })

  it('first band label is "Chapters 1-10"', () => {
    engine.selectBook('Psalms')
    expect(engine.getState().options[0].label).toBe('Chapters 1-10')
  })

  it('last band label is "Chapters 141-150"', () => {
    engine.selectBook('Psalms')
    const opts = engine.getState().options
    expect(opts[opts.length - 1].label).toBe('Chapters 141-150')
  })
})

// ---------------------------------------------------------------------------
// CHAPTER_RANGE_SELECT → CHAPTER_SELECT
// ---------------------------------------------------------------------------

describe('selectChapterRange', () => {
  beforeEach(() => {
    engine.selectTestament('Old')
    engine.selectBook('Psalms')
  })

  it('moves to CHAPTER_SELECT', () => {
    const s = engine.selectChapterRange(0)
    expect(s.stage).toBe('CHAPTER_SELECT')
  })

  it('shows only the chapters in the selected band', () => {
    engine.selectChapterRange(0) // band 0: chapters 1-10
    const options = engine.getState().options
    expect(options.map(o => o.value)).toEqual(
      ['1','2','3','4','5','6','7','8','9','10']
    )
  })

  it('shows the correct chapters for band 1', () => {
    engine.selectChapterRange(1) // band 1: chapters 11-20
    const options = engine.getState().options
    expect(options.map(o => o.value)).toEqual(
      ['11','12','13','14','15','16','17','18','19','20']
    )
  })

  it('throws when called from the wrong stage', () => {
    // Advance past CHAPTER_RANGE_SELECT into CHAPTER_SELECT, then VERSE_RANGE_SELECT
    engine.selectChapterRange(0)   // -> CHAPTER_SELECT
    engine.selectChapter('1')      // Psalms 1 = 10 verses -> VERSE_SELECT
    // Now stage is VERSE_SELECT — selectChapterRange must throw
    expect(() => engine.selectChapterRange(0)).toThrow(/wrong stage/)
  })
})

// ---------------------------------------------------------------------------
// CHAPTER_SELECT → VERSE_RANGE_SELECT (John 3: 36 verses > BAND_SIZE)
// ---------------------------------------------------------------------------

describe('selectChapter — long chapter (verse range)', () => {
  beforeEach(() => {
    engine.selectTestament('New')
    engine.selectBook('John')
  })

  it('moves to VERSE_RANGE_SELECT when chapter has > BAND_SIZE verses', () => {
    const s = engine.selectChapter('3')
    expect(s.stage).toBe('VERSE_RANGE_SELECT')
  })

  it('produces the correct number of verse bands', () => {
    engine.selectChapter('3')
    const options = engine.getState().options
    // 36 verses / 10 = 3 full bands + 1 partial = 4 bands
    expect(options).toHaveLength(4)
  })

  it('first verse band label is "Verses 1-10"', () => {
    engine.selectChapter('3')
    expect(engine.getState().options[0].label).toBe('Verses 1-10')
  })

  it('last verse band label is "Verses 31-36"', () => {
    engine.selectChapter('3')
    const opts = engine.getState().options
    expect(opts[opts.length - 1].label).toBe('Verses 31-36')
  })

  it('throws when an invalid chapter is given', () => {
    expect(() => engine.selectChapter('99')).toThrow(/not found/)
  })

  it('throws when called from the wrong stage', () => {
    expect(() => new NavigationEngine(makeStructure()).selectChapter('3')).toThrow(/wrong stage/)
  })
})

// ---------------------------------------------------------------------------
// CHAPTER_SELECT → VERSE_SELECT (Genesis 2: 25 verses > BAND_SIZE)
// ---------------------------------------------------------------------------

describe('selectChapter — also triggers VERSE_RANGE for Genesis ch2 (25 verses)', () => {
  it('goes to VERSE_RANGE_SELECT for Genesis 2 which has 25 verses', () => {
    engine.selectTestament('Old')
    engine.selectBook('Genesis')
    const s = engine.selectChapter('2')
    expect(s.stage).toBe('VERSE_RANGE_SELECT')
  })
})

// ---------------------------------------------------------------------------
// CHAPTER_SELECT → VERSE_SELECT (short chapter: Psalms ch1 = 10 verses = BAND_SIZE)
// ---------------------------------------------------------------------------

describe('selectChapter — short chapter (no verse range)', () => {
  beforeEach(() => {
    engine.selectTestament('Old')
    engine.selectBook('Psalms')
    engine.selectChapterRange(0)
  })

  it('moves directly to VERSE_SELECT when chapter has <= BAND_SIZE verses', () => {
    const s = engine.selectChapter('1')
    expect(s.stage).toBe('VERSE_SELECT')
  })

  it('lists all 10 verse options for Psalms 1', () => {
    engine.selectChapter('1')
    const options = engine.getState().options
    expect(options).toHaveLength(10)
    expect(options[0].value).toBe('1')
    expect(options[9].value).toBe('10')
  })
})

// ---------------------------------------------------------------------------
// VERSE_RANGE_SELECT → VERSE_SELECT
// ---------------------------------------------------------------------------

describe('selectVerseRange', () => {
  beforeEach(() => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3') // 36 verses → VERSE_RANGE_SELECT
  })

  it('moves to VERSE_SELECT', () => {
    const s = engine.selectVerseRange(0)
    expect(s.stage).toBe('VERSE_SELECT')
  })

  it('shows verses 1-10 for band 0', () => {
    engine.selectVerseRange(0)
    const options = engine.getState().options
    expect(options.map(o => o.value)).toEqual(
      ['1','2','3','4','5','6','7','8','9','10']
    )
  })

  it('shows verses 31-36 for band 3', () => {
    engine.selectVerseRange(3)
    const options = engine.getState().options
    expect(options.map(o => o.value)).toEqual(['31','32','33','34','35','36'])
  })

  it('throws when called from the wrong stage', () => {
    engine.selectVerseRange(0) // already advanced to VERSE_SELECT
    expect(() => engine.selectVerseRange(0)).toThrow(/wrong stage/)
  })
})

// ---------------------------------------------------------------------------
// VERSE_SELECT → READY_TO_DISPLAY
// ---------------------------------------------------------------------------

describe('selectVerse', () => {
  function navigateToVerseSelect() {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3')
    engine.selectVerseRange(1) // verses 11-20
  }

  it('moves to READY_TO_DISPLAY', () => {
    navigateToVerseSelect()
    const s = engine.selectVerse('16')
    expect(s.stage).toBe('READY_TO_DISPLAY')
  })

  it('produces the correct reference string', () => {
    navigateToVerseSelect()
    const s = engine.selectVerse('16')
    expect(s.reference).toBe('John 3:16')
  })

  it('throws when called from the wrong stage', () => {
    expect(() => engine.selectVerse('1')).toThrow(/wrong stage/)
  })
})

// ---------------------------------------------------------------------------
// Full happy path — Genesis 1:1 (short book, short chapter)
// ---------------------------------------------------------------------------

describe('full path — Genesis 1:1', () => {
  it('reaches READY_TO_DISPLAY with reference "Genesis 1:1"', () => {
    engine.selectTestament('Old')
    engine.selectBook('Genesis')
    // Genesis has 2 chapters (<= 10) — no range step
    engine.selectChapter('1')
    // Genesis 1 has 31 verses (> 10) — verse range step needed
    engine.selectVerseRange(0) // verses 1-10
    const s = engine.selectVerse('1')
    expect(s.stage).toBe('READY_TO_DISPLAY')
    expect(s.reference).toBe('Genesis 1:1')
  })
})

// ---------------------------------------------------------------------------
// Full happy path — John 3:16 (short book, long chapter)
// ---------------------------------------------------------------------------

describe('full path — John 3:16', () => {
  it('reaches READY_TO_DISPLAY with reference "John 3:16"', () => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3') // 36 verses → VERSE_RANGE_SELECT
    engine.selectVerseRange(1) // verses 11-20
    const s = engine.selectVerse('16')
    expect(s.stage).toBe('READY_TO_DISPLAY')
    expect(s.reference).toBe('John 3:16')
  })
})

// ---------------------------------------------------------------------------
// Full happy path — Psalms 119:105 (long book, long chapter skipped here,
//   but Psalms chapters all have 10 verses so no verse range needed)
// ---------------------------------------------------------------------------

describe('full path — Psalms 119:9 (long book, chapter range required)', () => {
  it('reaches READY_TO_DISPLAY with reference "Psalms 119:9"', () => {
    engine.selectTestament('Old')
    engine.selectBook('Psalms') // 150 chapters → CHAPTER_RANGE_SELECT
    // band 11 covers chapters 111-120 (0-indexed: band index 11)
    engine.selectChapterRange(11)
    engine.selectChapter('119') // 10 verses → VERSE_SELECT directly
    const s = engine.selectVerse('9')
    expect(s.stage).toBe('READY_TO_DISPLAY')
    expect(s.reference).toBe('Psalms 119:9')
  })
})

// ---------------------------------------------------------------------------
// back() navigation
// ---------------------------------------------------------------------------

describe('back()', () => {
  it('is a no-op at TESTAMENT_SELECT', () => {
    engine.back()
    expect(engine.getState().stage).toBe('TESTAMENT_SELECT')
  })

  it('returns from BOOK_SELECT to TESTAMENT_SELECT and clears testament', () => {
    engine.selectTestament('Old')
    engine.back()
    const s = engine.getState()
    expect(s.stage).toBe('TESTAMENT_SELECT')
    expect(s.selectedTestament).toBeNull()
  })

  it('returns from CHAPTER_RANGE_SELECT to BOOK_SELECT', () => {
    engine.selectTestament('Old')
    engine.selectBook('Psalms')
    engine.back()
    expect(engine.getState().stage).toBe('BOOK_SELECT')
  })

  it('returns from CHAPTER_SELECT (via range) to CHAPTER_RANGE_SELECT', () => {
    engine.selectTestament('Old')
    engine.selectBook('Psalms')
    engine.selectChapterRange(0)
    engine.back()
    expect(engine.getState().stage).toBe('CHAPTER_RANGE_SELECT')
  })

  it('returns from CHAPTER_SELECT (no range) to BOOK_SELECT', () => {
    engine.selectTestament('Old')
    engine.selectBook('Genesis')
    engine.back()
    expect(engine.getState().stage).toBe('BOOK_SELECT')
  })

  it('returns from VERSE_RANGE_SELECT to CHAPTER_SELECT', () => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3')
    engine.back()
    expect(engine.getState().stage).toBe('CHAPTER_SELECT')
  })

  it('returns from VERSE_SELECT (via range) to VERSE_RANGE_SELECT', () => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3')
    engine.selectVerseRange(0)
    engine.back()
    expect(engine.getState().stage).toBe('VERSE_RANGE_SELECT')
  })

  it('returns from VERSE_SELECT (no range) to CHAPTER_SELECT', () => {
    engine.selectTestament('Old')
    engine.selectBook('Psalms')
    engine.selectChapterRange(0)
    engine.selectChapter('1') // 10 verses — no VERSE_RANGE step
    engine.back()
    expect(engine.getState().stage).toBe('CHAPTER_SELECT')
  })

  it('returns from READY_TO_DISPLAY to VERSE_SELECT', () => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3')
    engine.selectVerseRange(1)
    engine.selectVerse('16')
    engine.back()
    expect(engine.getState().stage).toBe('VERSE_SELECT')
  })

  it('clears reference when stepping back from READY_TO_DISPLAY', () => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3')
    engine.selectVerseRange(1)
    engine.selectVerse('16')
    engine.back()
    expect(engine.getState().reference).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('reset()', () => {
  it('returns to TESTAMENT_SELECT from any stage', () => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3')
    engine.reset()
    expect(engine.getState().stage).toBe('TESTAMENT_SELECT')
  })

  it('clears all selections', () => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3')
    engine.selectVerseRange(1)
    engine.selectVerse('16')
    engine.reset()
    const s = engine.getState()
    expect(s.selectedTestament).toBeNull()
    expect(s.selectedBook).toBeNull()
    expect(s.selectedChapter).toBeNull()
    expect(s.selectedVerse).toBeNull()
    expect(s.reference).toBeNull()
  })

  it('offers Old/New Testament options again after reset', () => {
    engine.selectTestament('New')
    engine.selectBook('Jude')
    engine.reset()
    expect(engine.getState().options.map(o => o.value)).toEqual(['Old', 'New'])
  })
})

// ---------------------------------------------------------------------------
// READY_TO_DISPLAY options
// ---------------------------------------------------------------------------

describe('READY_TO_DISPLAY options', () => {
  it('has one option equal to the reference string', () => {
    engine.selectTestament('New')
    engine.selectBook('John')
    engine.selectChapter('3')
    engine.selectVerseRange(1)
    engine.selectVerse('16')
    const options = engine.getState().options
    expect(options).toHaveLength(1)
    expect(options[0].value).toBe('John 3:16')
  })
})

// ---------------------------------------------------------------------------
// BibleStructure helper functions (covers lines 60-70 in BibleStructure.ts)
// ---------------------------------------------------------------------------

import {
  getBookNames,
  getChapterKeys,
  getVerseCount,
  getBookMeta,
  bookExists,
  chapterExists,
  groupIntoBands,
  bandLabel,
} from '../navigation/BibleStructure.js'

describe('BibleStructure helpers', () => {
  const structure = makeStructure()

  it('getBookNames returns books sorted by index', () => {
    const names = getBookNames(structure)
    expect(names[0]).toBe('Genesis')
    expect(names[names.length - 1]).toBe('Jude')
  })

  it('getChapterKeys returns sorted chapter keys', () => {
    const keys = getChapterKeys(structure, 'Genesis')
    expect(keys).toEqual(['1', '2'])
  })

  it('getChapterKeys returns empty array for unknown book', () => {
    expect(getChapterKeys(structure, 'Hezekiah')).toEqual([])
  })

  it('getVerseCount returns correct count', () => {
    expect(getVerseCount(structure, 'John', '3')).toBe(36)
  })

  it('getVerseCount returns 0 for unknown book', () => {
    expect(getVerseCount(structure, 'Hezekiah', '1')).toBe(0)
  })

  it('getBookMeta returns metadata for a known book', () => {
    const meta = getBookMeta(structure, 'Genesis')
    expect(meta?.testament).toBe('Old')
    expect(meta?.index).toBe(1)
  })

  it('getBookMeta returns undefined for unknown book', () => {
    expect(getBookMeta(structure, 'Hezekiah')).toBeUndefined()
  })

  it('bookExists returns true for known book', () => {
    expect(bookExists(structure, 'John')).toBe(true)
  })

  it('bookExists returns false for unknown book', () => {
    expect(bookExists(structure, 'Hezekiah')).toBe(false)
  })

  it('chapterExists returns true for valid chapter', () => {
    expect(chapterExists(structure, 'John', '3')).toBe(true)
  })

  it('chapterExists returns false for unknown chapter', () => {
    expect(chapterExists(structure, 'John', '99')).toBe(false)
  })

  it('chapterExists returns false for unknown book', () => {
    expect(chapterExists(structure, 'Hezekiah', '1')).toBe(false)
  })

  it('groupIntoBands produces correct number of bands', () => {
    const items = Array.from({ length: 25 }, (_, i) => String(i + 1))
    const bands = groupIntoBands(items, 10)
    expect(bands).toHaveLength(3)
    expect(bands[2]).toEqual(['21','22','23','24','25'])
  })

  it('bandLabel returns single item when band has one element', () => {
    expect(bandLabel(['7'])).toBe('7')
  })

  it('bandLabel returns empty string for empty band', () => {
    expect(bandLabel([])).toBe('')
  })
})