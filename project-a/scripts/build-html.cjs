/**
 * build-html.cjs
 *
 * Reads all translation JSON files from src/bible_data/ and generates a
 * self-contained src/index.html with all Bible data inlined as JavaScript
 * variables. This avoids fetch() calls which are blocked by OBS CEF
 * on file:// URLs.
 *
 * Run from the repo root:
 *   npm run build --workspace=project-a
 *
 * Output: project-a/src/index.html (overwritten with inlined data)
 */

const fs   = require('fs')
const path = require('path')

const BIBLE_DATA_DIR = path.join(__dirname, '..', 'src', 'bible_data')
const TEMPLATE_PATH  = path.join(__dirname, 'index.template.html')
const OUTPUT_PATH    = path.join(__dirname, '..', 'src', 'index.html')

// ── Load all translations ──────────────────────────────────────────────────
const translations = {}
const files = fs.readdirSync(BIBLE_DATA_DIR)
  .filter(f => f.endsWith('.json') && f !== 'bible_structure.json')

if (files.length === 0) {
  console.error('No translation JSON files found in', BIBLE_DATA_DIR)
  process.exit(1)
}

files.forEach(file => {
  const name = path.basename(file, '.json')
  const data = JSON.parse(fs.readFileSync(path.join(BIBLE_DATA_DIR, file), 'utf8'))
  translations[name] = data
  console.log(`Loaded ${name}: ${data.length} verses`)
})

const translationNames     = Object.keys(translations).sort()
const defaultTranslation   = translationNames.includes('KJV') ? 'KJV' : translationNames[0]

// ── Build the inlined data block ───────────────────────────────────────────
const dataBlock = `var BIBLE_TRANSLATIONS = ${JSON.stringify(translations)};
    var TRANSLATION_NAMES = ${JSON.stringify(translationNames)};
    var DEFAULT_TRANSLATION = '${defaultTranslation}';`

// ── Read template and inject ───────────────────────────────────────────────
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8')
const output   = template.replace('var BIBLE_TRANSLATIONS = __BIBLE_DATA_PLACEHOLDER__', dataBlock)

fs.writeFileSync(OUTPUT_PATH, output, 'utf8')
console.log(`\nBuilt: ${OUTPUT_PATH}`)
console.log(`Translations: ${translationNames.join(', ')}`)
console.log(`Default: ${defaultTranslation}`)
