/**
 * NavigationEngine.ts
 *
 * Pure TypeScript state machine that tracks the operator's position
 * as they navigate the Bible via Companion button presses.
 *
 * STATE MACHINE
 * =============
 *
 *   TESTAMENT_SELECT
 *        |
 *        v  selectTestament('Old' | 'New')
 *   BOOK_SELECT
 *        |
 *        v  selectBook(bookName)
 *   CHAPTER_RANGE_SELECT   <-- skipped if book has <= BAND_SIZE chapters
 *        |
 *        v  selectChapterRange(bandIndex)
 *   CHAPTER_SELECT
 *        |
 *        v  selectChapter(chapterKey)
 *   VERSE_RANGE_SELECT     <-- skipped if chapter has <= BAND_SIZE verses
 *        |
 *        v  selectVerseRange(bandIndex)
 *   VERSE_SELECT
 *        |
 *        v  selectVerse(verseNumber)
 *   READY_TO_DISPLAY
 *
 * Calling back() from any state returns to the previous state.
 * Calling reset() returns to TESTAMENT_SELECT.
 *
 * Zero side effects — no WebSocket, no BroadcastChannel, no file I/O.
 * Every method returns the new NavigationState so callers can react.
 */

import {
  getBookNames,
  getChapterKeys,
  getVerseCount,
  groupIntoBands,
  bandLabel,
  type BibleStructureData,
} from './BibleStructure.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of items per range-selection band (chapters or verses). */
export const BAND_SIZE = 10

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NavStage =
  | 'TESTAMENT_SELECT'
  | 'BOOK_SELECT'
  | 'CHAPTER_RANGE_SELECT'
  | 'CHAPTER_SELECT'
  | 'VERSE_RANGE_SELECT'
  | 'VERSE_SELECT'
  | 'READY_TO_DISPLAY'

export type Testament = 'Old' | 'New'

/**
 * A single button option presented to the operator at a given stage.
 * `value` is what gets passed back to the selectXxx() method.
 * `label` is the human-readable string shown on the Companion button.
 */
export interface NavOption {
  value: string
  label: string
}

/** The full navigation state returned after every action. */
export interface NavigationState {
  stage: NavStage
  /** Options the operator can choose at the current stage. */
  options: NavOption[]
  /** Selections made so far (populated as the operator navigates). */
  selectedTestament: Testament | null
  selectedBook: string | null
  selectedChapterRangeBandIndex: number | null
  selectedChapter: string | null
  selectedVerseRangeBandIndex: number | null
  selectedVerse: string | null
  /** Fully-qualified reference string, only set when stage === READY_TO_DISPLAY. */
  reference: string | null
}

// ---------------------------------------------------------------------------
// NavigationEngine
// ---------------------------------------------------------------------------

export class NavigationEngine {
  private structure: BibleStructureData

  // Current selections
  private _stage: NavStage = 'TESTAMENT_SELECT'
  private _testament: Testament | null = null
  private _book: string | null = null
  private _chapterRangeBandIndex: number | null = null
  private _chapter: string | null = null
  private _verseRangeBandIndex: number | null = null
  private _verse: string | null = null

  constructor(structure: BibleStructureData) {
    this.structure = structure
  }

  // -------------------------------------------------------------------------
  // Public state accessors
  // -------------------------------------------------------------------------

  get stage(): NavStage { return this._stage }

  /** Returns the full NavigationState object reflecting the current position. */
  getState(): NavigationState {
    return {
      stage: this._stage,
      options: this._buildOptions(),
      selectedTestament: this._testament,
      selectedBook: this._book,
      selectedChapterRangeBandIndex: this._chapterRangeBandIndex,
      selectedChapter: this._chapter,
      selectedVerseRangeBandIndex: this._verseRangeBandIndex,
      selectedVerse: this._verse,
      reference: this._buildReference(),
    }
  }

  // -------------------------------------------------------------------------
  // Navigation actions
  // -------------------------------------------------------------------------

  /** Step 1: Choose Old or New Testament. */
  selectTestament(testament: Testament): NavigationState {
    this._testament = testament
    this._book = null
    this._chapterRangeBandIndex = null
    this._chapter = null
    this._verseRangeBandIndex = null
    this._verse = null
    this._stage = 'BOOK_SELECT'
    return this.getState()
  }

  /** Step 2: Choose a book (must be a book name present in the structure). */
  selectBook(book: string): NavigationState {
    if (!this._testament) throw new Error('Must select testament before book.')
    const bookMeta = this.structure.books[book]
    if (!bookMeta) throw new Error(`Book not found in structure: "${book}"`)
    if (bookMeta.testament !== this._testament) {
      throw new Error(`Book "${book}" is ${bookMeta.testament} Testament, but ${this._testament} was selected.`)
    }

    this._book = book
    this._chapterRangeBandIndex = null
    this._chapter = null
    this._verseRangeBandIndex = null
    this._verse = null

    const chapters = getChapterKeys(this.structure, book)
    if (chapters.length > BAND_SIZE) {
      this._stage = 'CHAPTER_RANGE_SELECT'
    } else {
      this._stage = 'CHAPTER_SELECT'
    }
    return this.getState()
  }

  /** Step 3a (optional): Choose which band of chapters to drill into. */
  selectChapterRange(bandIndex: number): NavigationState {
    if (this._stage !== 'CHAPTER_RANGE_SELECT') {
      throw new Error(`selectChapterRange called from wrong stage: ${this._stage}`)
    }
    this._chapterRangeBandIndex = bandIndex
    this._chapter = null
    this._verseRangeBandIndex = null
    this._verse = null
    this._stage = 'CHAPTER_SELECT'
    return this.getState()
  }

  /** Step 3b: Choose a specific chapter. */
  selectChapter(chapterKey: string): NavigationState {
    if (this._stage !== 'CHAPTER_SELECT') {
      throw new Error(`selectChapter called from wrong stage: ${this._stage}`)
    }
    if (!this._book) throw new Error('No book selected.')
    const verseCount = getVerseCount(this.structure, this._book, chapterKey)
    if (verseCount === 0) {
      throw new Error(`Chapter "${chapterKey}" not found in book "${this._book}".`)
    }

    this._chapter = chapterKey
    this._verseRangeBandIndex = null
    this._verse = null

    if (verseCount > BAND_SIZE) {
      this._stage = 'VERSE_RANGE_SELECT'
    } else {
      this._stage = 'VERSE_SELECT'
    }
    return this.getState()
  }

  /** Step 4a (optional): Choose which band of verses to drill into. */
  selectVerseRange(bandIndex: number): NavigationState {
    if (this._stage !== 'VERSE_RANGE_SELECT') {
      throw new Error(`selectVerseRange called from wrong stage: ${this._stage}`)
    }
    this._verseRangeBandIndex = bandIndex
    this._verse = null
    this._stage = 'VERSE_SELECT'
    return this.getState()
  }

  /** Step 4b: Choose a specific verse. */
  selectVerse(verse: string): NavigationState {
    if (this._stage !== 'VERSE_SELECT') {
      throw new Error(`selectVerse called from wrong stage: ${this._stage}`)
    }
    this._verse = verse
    this._stage = 'READY_TO_DISPLAY'
    return this.getState()
  }

  /** Go back one stage, clearing the most recent selection. */
  back(): NavigationState {
    switch (this._stage) {
      case 'TESTAMENT_SELECT':
        // Already at root — no-op
        break
      case 'BOOK_SELECT':
        this._testament = null
        this._stage = 'TESTAMENT_SELECT'
        break
      case 'CHAPTER_RANGE_SELECT':
        this._book = null
        this._stage = 'BOOK_SELECT'
        break
      case 'CHAPTER_SELECT':
        this._chapter = null
        if (this._chapterRangeBandIndex !== null) {
          this._chapterRangeBandIndex = null
          this._stage = 'CHAPTER_RANGE_SELECT'
        } else {
          this._stage = 'BOOK_SELECT'
        }
        break
      case 'VERSE_RANGE_SELECT':
        this._verseRangeBandIndex = null
        this._stage = 'CHAPTER_SELECT'
        break
      case 'VERSE_SELECT':
        this._verse = null
        if (this._verseRangeBandIndex !== null) {
          this._verseRangeBandIndex = null
          this._stage = 'VERSE_RANGE_SELECT'
        } else {
          this._stage = 'CHAPTER_SELECT'
        }
        break
      case 'READY_TO_DISPLAY':
        this._verse = null
        this._stage = 'VERSE_SELECT'
        break
    }
    return this.getState()
  }

  /** Reset to the very beginning. */
  reset(): NavigationState {
    this._stage = 'TESTAMENT_SELECT'
    this._testament = null
    this._book = null
    this._chapterRangeBandIndex = null
    this._chapter = null
    this._verseRangeBandIndex = null
    this._verse = null
    return this.getState()
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _buildOptions(): NavOption[] {
    switch (this._stage) {
      case 'TESTAMENT_SELECT':
        return [
          { value: 'Old', label: 'Old Testament' },
          { value: 'New', label: 'New Testament' },
        ]

      case 'BOOK_SELECT': {
        const allBooks = getBookNames(this.structure)
        return allBooks
          .filter(name => this.structure.books[name].testament === this._testament)
          .map(name => ({ value: name, label: name }))
      }

      case 'CHAPTER_RANGE_SELECT': {
        if (!this._book) return []
        const chapters = getChapterKeys(this.structure, this._book)
        const bands = groupIntoBands(chapters, BAND_SIZE)
        return bands.map((band, i) => ({
          value: String(i),
          label: `Chapters ${bandLabel(band)}`,
        }))
      }

      case 'CHAPTER_SELECT': {
        if (!this._book) return []
        const chapters = getChapterKeys(this.structure, this._book)
        if (this._chapterRangeBandIndex !== null) {
          const bands = groupIntoBands(chapters, BAND_SIZE)
          const band = bands[this._chapterRangeBandIndex] ?? []
          return band.map(ch => ({ value: ch, label: `Chapter ${ch}` }))
        }
        return chapters.map(ch => ({ value: ch, label: `Chapter ${ch}` }))
      }

      case 'VERSE_RANGE_SELECT': {
        if (!this._book || !this._chapter) return []
        const verseCount = getVerseCount(this.structure, this._book, this._chapter)
        const verses = Array.from({ length: verseCount }, (_, i) => String(i + 1))
        const bands = groupIntoBands(verses, BAND_SIZE)
        return bands.map((band, i) => ({
          value: String(i),
          label: `Verses ${bandLabel(band)}`,
        }))
      }

      case 'VERSE_SELECT': {
        if (!this._book || !this._chapter) return []
        const verseCount = getVerseCount(this.structure, this._book, this._chapter)
        const allVerses = Array.from({ length: verseCount }, (_, i) => String(i + 1))
        if (this._verseRangeBandIndex !== null) {
          const bands = groupIntoBands(allVerses, BAND_SIZE)
          const band = bands[this._verseRangeBandIndex] ?? []
          return band.map(v => ({ value: v, label: `Verse ${v}` }))
        }
        return allVerses.map(v => ({ value: v, label: `Verse ${v}` }))
      }

      case 'READY_TO_DISPLAY':
        // No further selection needed — return the final reference as the only option.
        return this._buildReference()
          ? [{ value: this._buildReference()!, label: this._buildReference()! }]
          : []
    }
  }

  private _buildReference(): string | null {
    if (this._stage !== 'READY_TO_DISPLAY') return null
    if (!this._book || !this._chapter || !this._verse) return null
    return `${this._book} ${this._chapter}:${this._verse}`
  }
}
