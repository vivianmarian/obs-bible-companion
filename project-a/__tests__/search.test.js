import { searchBible, findVerseIndexByReference } from '../src/js/search.js'

// ── Fixtures ───────────────────────────────────────────────────────────────
const SAMPLE_DATA = [
  { name: 'Genesis 1:1',  verse: 'In the beginning God created the heaven and the earth.',          ari: '1:1:1'   },
  { name: 'Genesis 1:2',  verse: 'And the earth was without form, and void.',                       ari: '1:1:2'   },
  { name: 'John 3:16',    verse: 'For God so loved the world, that he gave his only begotten Son.', ari: '43:3:16' },
  { name: 'John 3:17',    verse: 'For God sent not his Son into the world to condemn the world.',   ari: '43:3:17' },
  { name: 'Psalm 23:1',   verse: 'The LORD is my shepherd; I shall not want.',                      ari: '19:23:1' },
]

// ── searchBible ────────────────────────────────────────────────────────────

describe('searchBible', () => {
  it('returns matching verses when query matches a reference name', () => {
    const results = searchBible('John 3:16', SAMPLE_DATA)
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('John 3:16')
  })

  it('returns matching verses when query matches verse text', () => {
    const results = searchBible('shepherd', SAMPLE_DATA)
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Psalm 23:1')
  })

  it('matching is case-insensitive for both reference and text', () => {
    const results = searchBible('GOD CREATED', SAMPLE_DATA)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name).toBe('Genesis 1:1')
  })

  it('returns multiple results when query matches more than one verse', () => {
    const results = searchBible('God', SAMPLE_DATA)
    expect(results.length).toBeGreaterThan(1)
  })

  it('returns empty array when query does not match any verse', () => {
    const results = searchBible('xyzzy no match here', SAMPLE_DATA)
    expect(results).toHaveLength(0)
  })

  it('returns empty array when bibleData is empty', () => {
    const results = searchBible('Genesis', [])
    expect(results).toHaveLength(0)
  })

  it('returns empty array when query is an empty string', () => {
    const results = searchBible('', SAMPLE_DATA)
    expect(results).toHaveLength(0)
  })

  it('returns empty array when query is only whitespace', () => {
    const results = searchBible('   ', SAMPLE_DATA)
    expect(results).toHaveLength(0)
  })

  it('returns empty array when query is null', () => {
    const results = searchBible(null, SAMPLE_DATA)
    expect(results).toHaveLength(0)
  })

  it('returns empty array when bibleData is not an array', () => {
    const results = searchBible('Genesis', null)
    expect(results).toHaveLength(0)
  })

  it('attaches __index property reflecting position in bibleData array', () => {
    const results = searchBible('John 3:16', SAMPLE_DATA)
    expect(results[0].__index).toBe(2)
  })

  it('caps results at 50 even when more matches exist', () => {
    const bigData = Array.from({ length: 100 }, (_, i) => ({
      name: `Book ${i + 1}:1`,
      verse: 'test verse content',
      ari: `${i + 1}:1:1`,
    }))
    const results = searchBible('test', bigData)
    expect(results).toHaveLength(50)
  })

  it('returns partial reference match — "John 3" returns all John 3 verses', () => {
    const results = searchBible('John 3', SAMPLE_DATA)
    expect(results.length).toBeGreaterThanOrEqual(2)
    results.forEach((r) => expect(r.name).toMatch(/^John 3:/))
  })
})

// ── findVerseIndexByReference ──────────────────────────────────────────────

describe('findVerseIndexByReference', () => {
  it('returns the correct index for a known reference', () => {
    expect(findVerseIndexByReference('John 3:16', SAMPLE_DATA)).toBe(2)
  })

  it('returns the index of the first verse (index 0)', () => {
    expect(findVerseIndexByReference('Genesis 1:1', SAMPLE_DATA)).toBe(0)
  })

  it('returns the index of the last verse', () => {
    expect(findVerseIndexByReference('Psalm 23:1', SAMPLE_DATA)).toBe(4)
  })

  it('matching is case-insensitive', () => {
    expect(findVerseIndexByReference('john 3:16', SAMPLE_DATA)).toBe(2)
    expect(findVerseIndexByReference('JOHN 3:16', SAMPLE_DATA)).toBe(2)
  })

  it('trims whitespace from the reference before matching', () => {
    expect(findVerseIndexByReference('  John 3:16  ', SAMPLE_DATA)).toBe(2)
  })

  it('returns -1 when reference is not found', () => {
    expect(findVerseIndexByReference('Zephaniah 1:1', SAMPLE_DATA)).toBe(-1)
  })

  it('returns -1 when reference is an empty string', () => {
    expect(findVerseIndexByReference('', SAMPLE_DATA)).toBe(-1)
  })

  it('returns -1 when reference is null', () => {
    expect(findVerseIndexByReference(null, SAMPLE_DATA)).toBe(-1)
  })

  it('returns -1 when bibleData is empty', () => {
    expect(findVerseIndexByReference('John 3:16', [])).toBe(-1)
  })

  it('returns -1 when bibleData is not an array', () => {
    expect(findVerseIndexByReference('John 3:16', null)).toBe(-1)
  })
})
