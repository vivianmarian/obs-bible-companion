'use strict'

/** @type {Array<{name: string, verse: string, ari: string}>} */
let bibleData = []

/** @type {string} */
let currentTranslationName = 'KJV'

const STORAGE_KEY = 'obs_bible_translation'

/**
 * Returns the currently loaded bible data array.
 *
 * @returns {Array<{name: string, verse: string, ari: string}>}
 */
export function getBibleData() {
  return bibleData
}

/**
 * Returns the name of the currently loaded translation.
 *
 * @returns {string} e.g. 'KJV'
 */
export function getCurrentTranslationName() {
  return currentTranslationName
}

/**
 * Loads a translation JSON file by name. On success, replaces bibleData and
 * persists the choice to localStorage. On failure, logs an error and keeps
 * the previously loaded data — bibleData is never left empty after initial load.
 *
 * @param {string} name - Translation name without extension, e.g. 'KJV'
 * @param {string} [basePath='./bible_data/'] - Override for testing
 * @returns {Promise<boolean>} true if loaded successfully, false on error
 */
export async function loadTranslation(name, basePath = './bible_data/') {
  if (!name || typeof name !== 'string') {
    console.error('[OBS Bible] loadTranslation: name must be a non-empty string')
    return false
  }

  const url = `${basePath}${name}.json`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`)
    }
    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Translation file ${url} is empty or not an array`)
    }
    bibleData = data
    currentTranslationName = name
    try {
      localStorage.setItem(STORAGE_KEY, name)
    } catch (_) {
      // localStorage may not be available in all environments
    }
    console.log(`[OBS Bible] Loaded translation: ${name} (${data.length} verses)`)
    return true
  } catch (err) {
    console.error(`[OBS Bible] Failed to load translation "${name}":`, err)
    return false
  }
}

/**
 * Returns the list of available translation names.
 *
 * @returns {string[]}
 */
export function getAvailableTranslations() {
  return ['KJV', 'NIV', 'NKJV']
}

/**
 * Reads localStorage for a previously saved translation and loads it.
 * Falls back to defaultTranslation if nothing is saved or loading fails.
 *
 * @param {string} [defaultTranslation='KJV']
 * @param {string} [basePath='./bible_data/']
 * @returns {Promise<void>}
 */
export async function initTranslation(defaultTranslation = 'KJV', basePath = './bible_data/') {
  let saved = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch (_) {}

  const target = saved || defaultTranslation
  const success = await loadTranslation(target, basePath)

  if (!success && target !== defaultTranslation) {
    console.warn(`[OBS Bible] Saved translation "${target}" failed to load; falling back to ${defaultTranslation}`)
    await loadTranslation(defaultTranslation, basePath)
  }
}

/**
 * Resets bibleData to empty and clears stored translation name.
 * Used in tests only.
 *
 * @returns {void}
 */
export function _resetForTesting() {
  bibleData = []
  currentTranslationName = 'KJV'
}

/**
 * Directly sets bibleData to the provided array.
 * Used in tests only — avoids the need for fetch() mocking in ESM environments.
 *
 * @param {Array<{name: string, verse: string, ari: string}>} data
 * @returns {void}
 */
export function __setDataForTesting(data) {
  bibleData = data
}
