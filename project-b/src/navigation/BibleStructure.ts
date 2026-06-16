/**
 * BibleStructure.ts
 *
 * Defines the canonical BibleStructure types and exposes pure helper
 * functions over them.
 *
 * Types are defined HERE (not re-exported from MetadataGenerator) to avoid
 * ts-jest ESM aliased re-export resolution failures.
 *
 * MetadataGenerator imports these types from this file.
 */

// ---------------------------------------------------------------------------
// Types (single source of truth)
// ---------------------------------------------------------------------------

/** Per-chapter data: map of chapter number (string) => verse count. */
export type ChapterMap = Record<string, number>

/** Per-book data stored in bible_structure.json. */
export interface BookMeta {
  testament: 'Old' | 'New'
  index: number
  chapters: ChapterMap
}

/** Shape of the generated bible_structure.json. */
export interface BibleStructureData {
  books: Record<string, BookMeta>
  translations: string[]
  totalVerses: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/** Returns book names in canonical order (Genesis -> Revelation). */
export function getBookNames(structure: BibleStructureData): string[] {
  return Object.entries(structure.books)
    .sort(([, a], [, b]) => a.index - b.index)
    .map(([name]) => name)
}

/** Returns chapter keys for a book, sorted numerically. */
export function getChapterKeys(structure: BibleStructureData, book: string): string[] {
  const meta = structure.books[book]
  if (!meta) return []
  return Object.keys(meta.chapters).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
}

/** Returns verse count for a book+chapter, or 0 if not found. */
export function getVerseCount(structure: BibleStructureData, book: string, chapter: string): number {
  return structure.books[book]?.chapters[chapter] ?? 0
}

/** Returns BookMeta for a book, or undefined. */
export function getBookMeta(structure: BibleStructureData, book: string): BookMeta | undefined {
  return structure.books[book]
}

/** Returns true if the book exists in the structure. */
export function bookExists(structure: BibleStructureData, book: string): boolean {
  return book in structure.books
}

/** Returns true if the chapter exists for the given book. */
export function chapterExists(structure: BibleStructureData, book: string, chapter: string): boolean {
  return (structure.books[book]?.chapters[chapter] ?? 0) > 0
}

/**
 * Groups items into bands of bandSize.
 * e.g. groupIntoBands(['1'..'31'], 10) => [['1'..'10'], ['11'..'20'], ['21'..'31']]
 */
export function groupIntoBands(items: string[], bandSize: number): string[][] {
  const bands: string[][] = []
  for (let i = 0; i < items.length; i += bandSize) {
    bands.push(items.slice(i, i + bandSize))
  }
  return bands
}

/**
 * Returns a human-readable label for a band.
 * e.g. ['1','2',...,'10'] => '1-10'
 */
export function bandLabel(band: string[]): string {
  if (band.length === 0) return ''
  if (band.length === 1) return band[0]
  return `${band[0]}-${band[band.length - 1]}`
}
