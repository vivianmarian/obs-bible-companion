/**
 * MetadataGenerator.ts
 *
 * Reads every translation JSON file in project-a/src/bible_data/,
 * derives the canonical book → chapter → verse-count structure from
 * the union of all translations, and writes the result to
 * project-a/src/bible_data/bible_structure.json.
 *
 * Run via:  npm run generate:metadata --workspace=project-b
 *
 * No book list, chapter count, or verse count is ever hardcoded here.
 * All values are derived entirely from the data files (Decision 12).
 */

import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One entry in a translation JSON array. */
export interface VerseEntry {
  name: string   // e.g. "John 3:16"
  verse: string  // verse text
  ari: string    // "bookIndex:chapter:verse"  e.g. "43:3:16"
}

/** Per-chapter data: map of chapter number (string) → verse count. */
export type ChapterMap = Record<string, number>

/** Per-book data stored in the output file. */
export interface BookMeta {
  testament: 'Old' | 'New'
  index: number       // 1-based canonical book index from ari
  chapters: ChapterMap
}

/** Shape of the generated bible_structure.json. */
export interface BibleStructure {
  books: Record<string, BookMeta>
  translations: string[]
  totalVerses: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Old-Testament / New-Testament boundary
// ---------------------------------------------------------------------------

/**
 * Books 1–39 are Old Testament, 40–66 are New Testament.
 * (Genesis = 1 … Malachi = 39 / Matthew = 40 … Revelation = 66)
 */
function testament(bookIndex: number): 'Old' | 'New' {
  return bookIndex <= 39 ? 'Old' : 'New'
}

// ---------------------------------------------------------------------------
// Core logic (exported so tests can call it without touching the filesystem)
// ---------------------------------------------------------------------------

/**
 * Parse a single translation's verse array and fold its data into
 * the accumulator maps.
 *
 * @param entries      Parsed JSON array from one translation file.
 * @param books        Mutable accumulator: bookName → BookMeta.
 * @param bookNameMap  Mutable accumulator: bookIndex → canonical book name
 *                     (first time we see a book we record its name).
 */
export function processTranslation(
  entries: VerseEntry[],
  books: Record<string, BookMeta>,
  bookNameMap: Record<number, string>,
): void {
  for (const entry of entries) {
    const parts = entry.ari.split(':')
    if (parts.length !== 3) {
      throw new Error(
        `Invalid ari format "${entry.ari}" in entry "${entry.name}". ` +
        `Expected "bookIndex:chapter:verse".`,
      )
    }

    const bookIndex = parseInt(parts[0], 10)
    const chapter   = parseInt(parts[1], 10)
    const verse     = parseInt(parts[2], 10)

    if (isNaN(bookIndex) || isNaN(chapter) || isNaN(verse)) {
      throw new Error(
        `Non-numeric ari component in "${entry.ari}" for entry "${entry.name}".`,
      )
    }

    // Derive the book name from the `name` field ("Book Chapter:Verse").
    // Split on the last space-then-chapter:verse portion.
    const nameMatch = entry.name.match(/^(.+?)\s+\d+:\d+$/)
    if (!nameMatch) {
      throw new Error(
        `Cannot parse book name from entry name "${entry.name}". ` +
        `Expected format "Book Chapter:Verse".`,
      )
    }
    const bookName = nameMatch[1]

    // Register the canonical name for this book index the first time we see it.
    if (!(bookIndex in bookNameMap)) {
      bookNameMap[bookIndex] = bookName
    }

    const canonicalName = bookNameMap[bookIndex]

    // Initialise BookMeta if this is the first verse we've seen for this book.
    if (!(canonicalName in books)) {
      books[canonicalName] = {
        testament: testament(bookIndex),
        index: bookIndex,
        chapters: {},
      }
    }

    const chapterKey = String(chapter)

    // Track the highest verse number seen for each chapter.
    const currentMax = books[canonicalName].chapters[chapterKey] ?? 0
    if (verse > currentMax) {
      books[canonicalName].chapters[chapterKey] = verse
    }
  }
}

/**
 * Generate a BibleStructure object from an array of (translationName, entries) pairs.
 * Pure function — no filesystem access.
 */
export function generateStructure(
  translations: Array<{ name: string; entries: VerseEntry[] }>,
): BibleStructure {
  const books: Record<string, BookMeta> = {}
  const bookNameMap: Record<number, string> = {}
  const translationNames: string[] = []

  for (const { name, entries } of translations) {
    translationNames.push(name)
    processTranslation(entries, books, bookNameMap)
  }

  // Sort books by canonical index for deterministic output.
  const sortedBooks: Record<string, BookMeta> = {}
  const sortedEntries = Object.entries(books).sort(
    ([, a], [, b]) => a.index - b.index,
  )
  for (const [bookName, meta] of sortedEntries) {
    // Sort chapter keys numerically for deterministic output.
    const sortedChapters: ChapterMap = {}
    const chapterKeys = Object.keys(meta.chapters).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10),
    )
    for (const ch of chapterKeys) {
      sortedChapters[ch] = meta.chapters[ch]
    }
    sortedBooks[bookName] = { ...meta, chapters: sortedChapters }
  }

  // totalVerses = sum of all verse counts across all books and chapters.
  let totalVerses = 0
  for (const meta of Object.values(sortedBooks)) {
    for (const count of Object.values(meta.chapters)) {
      totalVerses += count
    }
  }

  return {
    books: sortedBooks,
    translations: translationNames.sort(),
    totalVerses,
    generatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Filesystem I/O
// ---------------------------------------------------------------------------

/**
 * Read all *.json files from `dataDir`, parse them as VerseEntry arrays,
 * generate a BibleStructure, and write it to `outputPath`.
 */
export function run(dataDir: string, outputPath: string): BibleStructure {
  if (!fs.existsSync(dataDir)) {
    throw new Error(`Bible data directory not found: ${dataDir}`)
  }

  const jsonFiles = fs
    .readdirSync(dataDir)
    .filter(f => f.endsWith('.json') && f !== 'bible_structure.json')
    .sort() // deterministic order

  if (jsonFiles.length === 0) {
    throw new Error(`No translation JSON files found in ${dataDir}`)
  }

  const translations: Array<{ name: string; entries: VerseEntry[] }> = []

  for (const file of jsonFiles) {
    const translationName = path.basename(file, '.json')
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf-8')
    let entries: VerseEntry[]
    try {
      entries = JSON.parse(raw) as VerseEntry[]
    } catch (err) {
      throw new Error(`Failed to parse ${file}: ${(err as Error).message}`)
    }
    if (!Array.isArray(entries)) {
      throw new Error(`${file} must be a JSON array of verse objects.`)
    }
    translations.push({ name: translationName, entries })
  }

  const structure = generateStructure(translations)

  // Ensure the output directory exists.
  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(structure, null, 2) + '\n', 'utf-8')

  console.log(`✅ bible_structure.json written to ${outputPath}`)
  console.log(`   Books: ${Object.keys(structure.books).length}`)
  console.log(`   Translations: ${structure.translations.join(', ')}`)
  console.log(`   Total verse-count entries: ${structure.totalVerses}`)

  return structure
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

// When this file is executed directly (not imported as a module) we run the
// generator using paths relative to the monorepo root.
const isMain = process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)

if (isMain) {
  const repoRoot   = path.resolve(new URL(import.meta.url).pathname, '../../../../')
  const dataDir    = path.join(repoRoot, 'project-a', 'src', 'bible_data')
  const outputPath = path.join(dataDir, 'bible_structure.json')

  try {
    run(dataDir, outputPath)
  } catch (err) {
    console.error(`❌ MetadataGenerator failed: ${(err as Error).message}`)
    process.exit(1)
  }
}
