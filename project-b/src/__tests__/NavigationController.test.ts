/**
 * NavigationController.test.ts
 *
 * Tests the NavigationController's page-building logic and state machine
 * wiring. Uses the same in-memory BibleStructureData fixture as
 * NavigationEngine.test.ts — no filesystem access, no Companion SDK.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NavigationController, MAX_BUTTONS } from '../navigation/NavigationController.js'
import type { NavPage } from '../navigation/NavigationController.js'
import type { BibleStructureData } from '../navigation/BibleStructure.js'

// ---------------------------------------------------------------------------
// Fixture — same shape as NavigationEngine.test.ts
// ---------------------------------------------------------------------------

function makeStructure(): BibleStructureData {
  const psalmChapters: Record<string, number> = {}
  for (let i = 1; i <= 150; i++) psalmChapters[String(i)] = 10

  return {
    books: {
      Genesis:    { testament: 'Old', index: 1,  chapters: { '1': 31, '2': 25 } },
      Psalms:     { testament: 'Old', index: 19, chapters: psalmChapters },
      John:       { testament: 'New', index: 43, chapters: { '3': 36 } },
      Jude:       { testament: 'New', index: 65, chapters: { '1': 25 } },
    },
    translations: ['KJV'],
    totalVerses: 0,
    generatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeController() {
  const pages: NavPage[] = []
  const verses: string[] = []

  const controller = new NavigationController(
    makeStructure(),
    (page) => { pages.push(page) },
    (ref)  => { verses.push(ref) },
  )

  return { controller, pages, verses }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('getCurrentPage returns TESTAMENT_SELECT on init', () => {
    const { controller } = makeController()
    const page = controller.getCurrentPage()
    expect(page.stage).toBe('TESTAMENT_SELECT')
  })

  it('initial page title is "Select Testament"', () => {
    const { controller } = makeController()
    expect(controller.getCurrentPage().title).toBe('Select Testament')
  })

  it('initial page has Old Testament and New Testament buttons', () => {
    const { controller } = makeController()
    const labels = controller.getCurrentPage().buttons.map(b => b.label)
    expect(labels).toContain('Old Testament')
    expect(labels).toContain('New Testament')
  })

  it('initial page has a Reset button', () => {
    const { controller } = makeController()
    const styles = controller.getCurrentPage().buttons.map(b => b.style)
    expect(styles).toContain('reset')
  })

  it('initial page does NOT have a Back button (at root stage)', () => {
    const { controller } = makeController()
    const styles = controller.getCurrentPage().buttons.map(b => b.style)
    expect(styles).not.toContain('back')
  })
})

// ---------------------------------------------------------------------------
// Testament selection
// ---------------------------------------------------------------------------

describe('pressing Old Testament', () => {
  it('emits a BOOK_SELECT page', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    expect(pages[0].stage).toBe('BOOK_SELECT')
  })

  it('BOOK_SELECT page shows only Old Testament books', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    const labels = pages[0].buttons.map(b => b.label)
    expect(labels).toContain('Genesis')
    expect(labels).toContain('Psalms')
    expect(labels).not.toContain('John')
  })

  it('BOOK_SELECT page has a Back button', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    const styles = pages[0].buttons.map(b => b.style)
    expect(styles).toContain('back')
  })

  it('BOOK_SELECT page has a Reset button', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    const styles = pages[0].buttons.map(b => b.style)
    expect(styles).toContain('reset')
  })
})

describe('pressing New Testament', () => {
  it('emits a BOOK_SELECT page with only NT books', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('New')
    const labels = pages[0].buttons.map(b => b.label)
    expect(labels).toContain('John')
    expect(labels).toContain('Jude')
    expect(labels).not.toContain('Genesis')
  })
})

// ---------------------------------------------------------------------------
// Book selection — short book (Genesis: 2 chapters, no range)
// ---------------------------------------------------------------------------

describe('selecting Genesis (short book)', () => {
  function navigateToGenesis() {
    const { controller, pages, verses } = makeController()
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Genesis')
    return { controller, pages, verses }
  }

  it('emits a CHAPTER_SELECT page', () => {
    const { pages } = navigateToGenesis()
    expect(pages[1].stage).toBe('CHAPTER_SELECT')
  })

  it('CHAPTER_SELECT page shows Chapter 1 and Chapter 2', () => {
    const { pages } = navigateToGenesis()
    const labels = pages[1].buttons.map(b => b.label)
    expect(labels).toContain('Chapter 1')
    expect(labels).toContain('Chapter 2')
  })
})

// ---------------------------------------------------------------------------
// Book selection — long book (Psalms: 150 chapters, range required)
// ---------------------------------------------------------------------------

describe('selecting Psalms (long book)', () => {
  function navigateToPsalms() {
    const { controller, pages, verses } = makeController()
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Psalms')
    return { controller, pages, verses }
  }

  it('emits a CHAPTER_RANGE_SELECT page', () => {
    const { pages } = navigateToPsalms()
    expect(pages[1].stage).toBe('CHAPTER_RANGE_SELECT')
  })

  it('CHAPTER_RANGE_SELECT page has at most MAX_BUTTONS option buttons', () => {
    const { pages } = navigateToPsalms()
    const optionButtons = pages[1].buttons.filter(b => b.style === 'option')
    expect(optionButtons.length).toBeLessThanOrEqual(MAX_BUTTONS)
  })

  it('first chapter range button label starts with "Chapters"', () => {
    const { pages } = navigateToPsalms()
    const firstOption = pages[1].buttons.find(b => b.style === 'option')
    expect(firstOption?.label).toMatch(/^Chapters/)
  })
})

// ---------------------------------------------------------------------------
// Chapter selection — long chapter (Genesis 1: 31 verses, range required)
// ---------------------------------------------------------------------------

describe('selecting Genesis chapter 1 (long chapter)', () => {
  function navigateToGenesis1() {
    const { controller, pages, verses } = makeController()
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Genesis')
    controller.handleButtonPress('1')
    return { controller, pages, verses }
  }

  it('emits a VERSE_RANGE_SELECT page', () => {
    const { pages } = navigateToGenesis1()
    expect(pages[2].stage).toBe('VERSE_RANGE_SELECT')
  })

  it('VERSE_RANGE_SELECT page option buttons have "Verses" labels', () => {
    const { pages } = navigateToGenesis1()
    const options = pages[2].buttons.filter(b => b.style === 'option')
    expect(options.length).toBeGreaterThan(0)
    options.forEach(b => expect(b.label).toMatch(/^Verses/))
  })
})

// ---------------------------------------------------------------------------
// Full happy path — Psalms 1:5 (long book, short chapter, no verse range)
// ---------------------------------------------------------------------------

describe('full path — Psalms 1:5', () => {
  it('reaches READY_TO_DISPLAY and fires onVerseSelected', () => {
    const { controller, pages, verses } = makeController()
    controller.handleButtonPress('Old')           // BOOK_SELECT
    controller.handleButtonPress('Psalms')        // CHAPTER_RANGE_SELECT
    controller.handleButtonPress('0')             // CHAPTER_SELECT (band 0: ch 1-10)
    controller.handleButtonPress('1')             // VERSE_SELECT (ch1 = 10 verses, no range)
    controller.handleButtonPress('5')             // READY_TO_DISPLAY

    const lastPage = pages[pages.length - 1]
    expect(lastPage.stage).toBe('READY_TO_DISPLAY')
    expect(verses).toContain('Psalms 1:5')
  })

  it('READY_TO_DISPLAY page shows the reference as a button label', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Psalms')
    controller.handleButtonPress('0')
    controller.handleButtonPress('1')
    controller.handleButtonPress('5')

    const lastPage = pages[pages.length - 1]
    const readyButton = lastPage.buttons.find(b => b.style === 'ready')
    expect(readyButton?.label).toBe('Psalms 1:5')
  })

  it('READY_TO_DISPLAY page has a "New Verse" reset button', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Psalms')
    controller.handleButtonPress('0')
    controller.handleButtonPress('1')
    controller.handleButtonPress('5')

    const lastPage = pages[pages.length - 1]
    const resetButton = lastPage.buttons.find(b => b.style === 'reset')
    expect(resetButton?.label).toBe('New Verse')
  })
})

// ---------------------------------------------------------------------------
// Full happy path — John 3:16 (short book, long chapter)
// ---------------------------------------------------------------------------

describe('full path — John 3:16', () => {
  it('reaches READY_TO_DISPLAY with reference John 3:16 and fires onVerseSelected', () => {
    const { controller, pages, verses } = makeController()
    controller.handleButtonPress('New')           // BOOK_SELECT
    controller.handleButtonPress('John')          // CHAPTER_SELECT (1 chapter, no range)
    controller.handleButtonPress('3')             // VERSE_RANGE_SELECT (36 verses)
    controller.handleButtonPress('1')             // VERSE_SELECT (band 1: verses 11-20)
    controller.handleButtonPress('16')            // READY_TO_DISPLAY

    expect(verses).toContain('John 3:16')
    expect(pages[pages.length - 1].stage).toBe('READY_TO_DISPLAY')
  })
})

// ---------------------------------------------------------------------------
// Back button
// ---------------------------------------------------------------------------

describe('back button', () => {
  it('pressing Back from BOOK_SELECT returns to TESTAMENT_SELECT', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')       // -> BOOK_SELECT
    controller.handleButtonPress('nav_back')  // -> TESTAMENT_SELECT
    expect(pages[pages.length - 1].stage).toBe('TESTAMENT_SELECT')
  })

  it('pressing Back from CHAPTER_SELECT returns to BOOK_SELECT', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('New')
    controller.handleButtonPress('John')      // -> CHAPTER_SELECT
    controller.handleButtonPress('nav_back')  // -> BOOK_SELECT
    expect(pages[pages.length - 1].stage).toBe('BOOK_SELECT')
  })

  it('Back page does not have a Back button at TESTAMENT_SELECT', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    controller.handleButtonPress('nav_back')
    const styles = pages[pages.length - 1].buttons.map(b => b.style)
    expect(styles).not.toContain('back')
  })
})

// ---------------------------------------------------------------------------
// Reset button
// ---------------------------------------------------------------------------

describe('reset button', () => {
  it('pressing Reset from deep in the tree returns to TESTAMENT_SELECT', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Genesis')
    controller.handleButtonPress('nav_reset')
    expect(pages[pages.length - 1].stage).toBe('TESTAMENT_SELECT')
  })

  it('reset() method also returns to TESTAMENT_SELECT', () => {
    const { controller, pages } = makeController()
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Psalms')
    controller.reset()
    expect(pages[pages.length - 1].stage).toBe('TESTAMENT_SELECT')
  })
})

// ---------------------------------------------------------------------------
// onPageChange callback
// ---------------------------------------------------------------------------

describe('onPageChange callback', () => {
  it('is called once per button press', () => {
    const onPageChange = jest.fn((_page: NavPage) => {})
    const controller = new NavigationController(
      makeStructure(),
      onPageChange,
      () => {},
    )
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Genesis')
    expect(onPageChange).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// onVerseSelected callback
// ---------------------------------------------------------------------------

describe('onVerseSelected callback', () => {
  it('is called exactly once when a verse is selected', () => {
    const onVerseSelected = jest.fn((_ref: string) => {})
    const controller = new NavigationController(
      makeStructure(),
      () => {},
      onVerseSelected,
    )
    controller.handleButtonPress('Old')
    controller.handleButtonPress('Psalms')
    controller.handleButtonPress('0')
    controller.handleButtonPress('1')
    controller.handleButtonPress('5')
    expect(onVerseSelected).toHaveBeenCalledTimes(1)
    expect(onVerseSelected).toHaveBeenCalledWith('Psalms 1:5')
  })

  it('is NOT called when Back or Reset is pressed', () => {
    const onVerseSelected = jest.fn((_ref: string) => {})
    const controller = new NavigationController(
      makeStructure(),
      () => {},
      onVerseSelected,
    )
    controller.handleButtonPress('Old')
    controller.handleButtonPress('nav_back')
    controller.handleButtonPress('nav_reset')
    expect(onVerseSelected).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Unknown action ID
// ---------------------------------------------------------------------------

describe('unknown action ID', () => {
  it('pressing an unknown actionId does nothing and does not throw', () => {
    const { controller, pages } = makeController()
    expect(() => controller.handleButtonPress('nonexistent_action')).not.toThrow()
    expect(pages).toHaveLength(0)
  })
})