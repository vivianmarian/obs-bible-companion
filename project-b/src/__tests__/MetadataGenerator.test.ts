/**
 * MetadataGenerator.test.ts
 *
 * Tests for the pure-function layer of MetadataGenerator.
 * No filesystem access is used — we pass in-memory fixture data.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  processTranslation,
  generateStructure,
  run,
  type VerseEntry,
} from '../metadata/MetadataGenerator.js'
import type { BookMeta } from '../navigation/BibleStructure.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GENESIS_VERSES: VerseEntry[] = [
  { name: 'Genesis 1:1', verse: 'In the beginning God created the heavens and the earth.', ari: '1:1:1' },
  { name: 'Genesis 1:2', verse: 'Now the earth was formless and empty...', ari: '1:1:2' },
  { name: 'Genesis 1:31', verse: 'God saw all that he had made, and it was very good.', ari: '1:1:31' },
  { name: 'Genesis 2:1', verse: 'Thus the heavens and the earth were completed...', ari: '1:2:1' },
  { name: 'Genesis 2:25', verse: 'Adam and his wife were both naked...', ari: '1:2:25' },
]

const JOHN_VERSES: VerseEntry[] = [
  { name: 'John 3:16', verse: 'For God so loved the world...', ari: '43:3:16' },
  { name: 'John 3:17', verse: 'For God did not send his Son into the world to condemn the world...', ari: '43:3:17' },
  { name: 'John 3:36', verse: 'Whoever believes in the Son has eternal life...', ari: '43:3:36' },
]

const REVELATION_VERSES: VerseEntry[] = [
  { name: 'Revelation 22:1', verse: 'Then the angel showed me the river of the water of life...', ari: '66:22:1' },
  { name: 'Revelation 22:21', verse: 'The grace of the Lord Jesus be with God\'s people. Amen.', ari: '66:22:21' },
]

// ---------------------------------------------------------------------------
// processTranslation
// ---------------------------------------------------------------------------

describe('processTranslation', () => {
  let books: Record<string, BookMeta>
  let bookNameMap: Record<number, string>

  beforeEach(() => {
    books = {}
    bookNameMap = {}
  })

  it('creates a BookMeta entry for each new book encountered', () => {
    processTranslation(GENESIS_VERSES, books, bookNameMap)
    expect(books).toHaveProperty('Genesis')
  })

  it('assigns the correct testament for Old Testament books (index ≤ 39)', () => {
    processTranslation(GENESIS_VERSES, books, bookNameMap)
    expect(books['Genesis'].testament).toBe('Old')
  })

  it('assigns the correct testament for New Testament books (index ≥ 40)', () => {
    processTranslation(JOHN_VERSES, books, bookNameMap)
    expect(books['John'].testament).toBe('New')
  })

  it('assigns index 66 for Revelation', () => {
    processTranslation(REVELATION_VERSES, books, bookNameMap)
    expect(books['Revelation'].index).toBe(66)
  })

  it('tracks the highest verse number seen for each chapter', () => {
    processTranslation(GENESIS_VERSES, books, bookNameMap)
    // Genesis 1 has verse 1, 2, and 31 — max is 31
    expect(books['Genesis'].chapters['1']).toBe(31)
    // Genesis 2 has verse 1 and 25 — max is 25
    expect(books['Genesis'].chapters['2']).toBe(25)
  })

  it('updates max verse when a later entry in the same chapter has a higher number', () => {
    const entries: VerseEntry[] = [
      { name: 'Genesis 1:5', verse: 'v5', ari: '1:1:5' },
      { name: 'Genesis 1:1', verse: 'v1', ari: '1:1:1' },
      { name: 'Genesis 1:31', verse: 'v31', ari: '1:1:31' },
    ]
    processTranslation(entries, books, bookNameMap)
    expect(books['Genesis'].chapters['1']).toBe(31)
  })

  it('merges data from multiple calls (same book, different verses)', () => {
    const first: VerseEntry[] = [
      { name: 'John 3:16', verse: 'For God so loved...', ari: '43:3:16' },
    ]
    const second: VerseEntry[] = [
      { name: 'John 3:36', verse: 'Whoever believes...', ari: '43:3:36' },
    ]
    processTranslation(first, books, bookNameMap)
    processTranslation(second, books, bookNameMap)
    expect(books['John'].chapters['3']).toBe(36)
  })

  it('throws on a malformed ari (wrong number of segments)', () => {
    const bad: VerseEntry[] = [
      { name: 'Genesis 1:1', verse: 'test', ari: '1:1' }, // missing verse component
    ]
    expect(() => processTranslation(bad, books, bookNameMap)).toThrow(/Invalid ari format/)
  })

  it('throws on a non-numeric ari component', () => {
    const bad: VerseEntry[] = [
      { name: 'Genesis 1:1', verse: 'test', ari: 'one:1:1' },
    ]
    expect(() => processTranslation(bad, books, bookNameMap)).toThrow(/Non-numeric ari/)
  })

  it('throws when the entry name cannot be parsed to extract the book name', () => {
    const bad: VerseEntry[] = [
      { name: 'NoColonHere', verse: 'test', ari: '1:1:1' },
    ]
    expect(() => processTranslation(bad, books, bookNameMap)).toThrow(/Cannot parse book name/)
  })

  it('handles multi-word book names like "1 Kings"', () => {
    const entries: VerseEntry[] = [
      { name: '1 Kings 3:12', verse: 'Behold, I have given you a wise...', ari: '11:3:12' },
    ]
    processTranslation(entries, books, bookNameMap)
    expect(books).toHaveProperty('1 Kings')
    expect(books['1 Kings'].index).toBe(11)
    expect(books['1 Kings'].testament).toBe('Old')
  })

  it('handles multi-word New Testament book names like "1 Corinthians"', () => {
    const entries: VerseEntry[] = [
      { name: '1 Corinthians 13:4', verse: 'Love is patient...', ari: '46:13:4' },
    ]
    processTranslation(entries, books, bookNameMap)
    expect(books).toHaveProperty('1 Corinthians')
    expect(books['1 Corinthians'].testament).toBe('New')
  })
})

// ---------------------------------------------------------------------------
// generateStructure
// ---------------------------------------------------------------------------

describe('generateStructure', () => {
  it('returns a BibleStructure with books, translations, totalVerses, generatedAt', () => {
    const result = generateStructure([
      { name: 'KJV', entries: GENESIS_VERSES },
    ])
    expect(result).toHaveProperty('books')
    expect(result).toHaveProperty('translations')
    expect(result).toHaveProperty('totalVerses')
    expect(result).toHaveProperty('generatedAt')
  })

  it('lists translations in sorted order', () => {
    const result = generateStructure([
      { name: 'NIV', entries: JOHN_VERSES },
      { name: 'KJV', entries: JOHN_VERSES },
    ])
    expect(result.translations).toEqual(['KJV', 'NIV'])
  })

  it('sorts books by canonical index', () => {
    const result = generateStructure([
      { name: 'KJV', entries: [...JOHN_VERSES, ...GENESIS_VERSES, ...REVELATION_VERSES] },
    ])
    const bookNames = Object.keys(result.books)
    expect(bookNames[0]).toBe('Genesis')   // index 1
    expect(bookNames[1]).toBe('John')      // index 43
    expect(bookNames[2]).toBe('Revelation') // index 66
  })

  it('sorts chapter keys numerically within each book', () => {
    const result = generateStructure([{ name: 'KJV', entries: GENESIS_VERSES }])
    const chapterKeys = Object.keys(result.books['Genesis'].chapters)
    expect(chapterKeys).toEqual(['1', '2'])
  })

  it('calculates totalVerses as the sum of max-verse-number per chapter across all books', () => {
    // Genesis ch1 → 31 verses, ch2 → 25 verses, John ch3 → 36, Rev ch22 → 21
    // total = 31 + 25 + 36 + 21 = 113
    const result = generateStructure([
      {
        name: 'KJV',
        entries: [...GENESIS_VERSES, ...JOHN_VERSES, ...REVELATION_VERSES],
      },
    ])
    expect(result.totalVerses).toBe(31 + 25 + 36 + 21)
  })

  it('merges chapter data when two translations cover the same book', () => {
    const kjvGen: VerseEntry[] = [
      { name: 'Genesis 1:31', verse: 'kjv text', ari: '1:1:31' },
    ]
    const nivGen: VerseEntry[] = [
      { name: 'Genesis 1:31', verse: 'niv text', ari: '1:1:31' },
      { name: 'Genesis 2:3', verse: 'niv text', ari: '1:2:3' },
    ]
    const result = generateStructure([
      { name: 'KJV', entries: kjvGen },
      { name: 'NIV', entries: nivGen },
    ])
    // Both translations agree Genesis 1 has 31 verses
    expect(result.books['Genesis'].chapters['1']).toBe(31)
    // Chapter 2 comes only from NIV
    expect(result.books['Genesis'].chapters['2']).toBe(3)
  })

  it('generatedAt is a valid ISO 8601 timestamp', () => {
    const result = generateStructure([{ name: 'KJV', entries: JOHN_VERSES }])
    expect(() => new Date(result.generatedAt)).not.toThrow()
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt)
  })

  it('handles a translation with a single verse gracefully', () => {
    const single: VerseEntry[] = [
      { name: 'John 3:16', verse: 'For God so loved...', ari: '43:3:16' },
    ]
    const result = generateStructure([{ name: 'KJV', entries: single }])
    expect(result.books['John'].chapters['3']).toBe(16)
    expect(result.totalVerses).toBe(16)
  })
})

// ---------------------------------------------------------------------------
// run() — filesystem integration
// ---------------------------------------------------------------------------

describe('run', () => {
  let tmpDir: string
  let outputPath: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint3-test-'))
    outputPath = path.join(tmpDir, 'bible_structure.json')
  })

  // Clean up after each test
  // (Jest will garbage-collect tmpDir automatically if we don't, but let's be tidy)

  it('throws if the data directory does not exist', () => {
    expect(() => run('/nonexistent/path', outputPath)).toThrow(
      /Bible data directory not found/,
    )
  })

  it('throws if the data directory contains no JSON files', () => {
    expect(() => run(tmpDir, outputPath)).toThrow(
      /No translation JSON files found/,
    )
  })

  it('throws if a JSON file is not a valid JSON array', () => {
    fs.writeFileSync(path.join(tmpDir, 'BAD.json'), 'not json', 'utf-8')
    expect(() => run(tmpDir, outputPath)).toThrow(/Failed to parse/)
  })

  it('throws if a JSON file is valid JSON but not an array', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'BAD.json'),
      JSON.stringify({ not: 'an array' }),
      'utf-8',
    )
    expect(() => run(tmpDir, outputPath)).toThrow(/must be a JSON array/)
  })

  it('writes bible_structure.json and returns a BibleStructure', () => {
    const entries: VerseEntry[] = [
      { name: 'John 3:16', verse: 'For God so loved the world...', ari: '43:3:16' },
      { name: 'John 3:36', verse: 'Whoever believes...', ari: '43:3:36' },
    ]
    fs.writeFileSync(
      path.join(tmpDir, 'KJV.json'),
      JSON.stringify(entries),
      'utf-8',
    )

    const result = run(tmpDir, outputPath)

    expect(fs.existsSync(outputPath)).toBe(true)
    expect(result.books).toHaveProperty('John')
    expect(result.translations).toEqual(['KJV'])
  })

  it('skips bible_structure.json itself when scanning for translation files', () => {
    // Write a valid translation file
    const entries: VerseEntry[] = [
      { name: 'Genesis 1:1', verse: 'In the beginning...', ari: '1:1:1' },
    ]
    fs.writeFileSync(path.join(tmpDir, 'KJV.json'), JSON.stringify(entries), 'utf-8')

    // Pre-write a bible_structure.json that is NOT a valid verse array
    fs.writeFileSync(
      path.join(tmpDir, 'bible_structure.json'),
      JSON.stringify({ books: {}, translations: [], totalVerses: 0, generatedAt: '' }),
      'utf-8',
    )

    // Should not throw — bible_structure.json is excluded from processing
    expect(() => run(tmpDir, outputPath)).not.toThrow()
  })

  it('reads multiple translation files and merges them', () => {
    const kjv: VerseEntry[] = [
      { name: 'John 3:16', verse: 'For God so loved...', ari: '43:3:16' },
    ]
    const niv: VerseEntry[] = [
      { name: 'John 3:16', verse: 'For God so loved (NIV)...', ari: '43:3:16' },
      { name: 'John 3:36', verse: 'Whoever believes (NIV)...', ari: '43:3:36' },
    ]
    fs.writeFileSync(path.join(tmpDir, 'KJV.json'), JSON.stringify(kjv), 'utf-8')
    fs.writeFileSync(path.join(tmpDir, 'NIV.json'), JSON.stringify(niv), 'utf-8')

    const result = run(tmpDir, outputPath)

    expect(result.translations).toEqual(['KJV', 'NIV'])
    // Chapter 3 max verse = 36 (from NIV)
    expect(result.books['John'].chapters['3']).toBe(36)
  })

  it('output file is valid JSON with expected top-level keys', () => {
    const entries: VerseEntry[] = [
      { name: 'John 3:16', verse: 'For God so loved...', ari: '43:3:16' },
    ]
    fs.writeFileSync(path.join(tmpDir, 'KJV.json'), JSON.stringify(entries), 'utf-8')
    run(tmpDir, outputPath)

    const raw = fs.readFileSync(outputPath, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed).toHaveProperty('books')
    expect(parsed).toHaveProperty('translations')
    expect(parsed).toHaveProperty('totalVerses')
    expect(parsed).toHaveProperty('generatedAt')
  })

  it('output file ends with a newline (POSIX hygiene)', () => {
    const entries: VerseEntry[] = [
      { name: 'John 3:16', verse: 'For God so loved...', ari: '43:3:16' },
    ]
    fs.writeFileSync(path.join(tmpDir, 'KJV.json'), JSON.stringify(entries), 'utf-8')
    run(tmpDir, outputPath)

    const raw = fs.readFileSync(outputPath, 'utf-8')
    expect(raw.endsWith('\n')).toBe(true)
  })
})
