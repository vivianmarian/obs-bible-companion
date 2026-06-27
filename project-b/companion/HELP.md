# OBS Bible Companion

Display Bible verses in OBS Studio using Bitfocus Companion button presses — no typing required during a live church service.

## How It Works

This module connects to a small relay server that runs alongside Companion. The relay bridges between Companion and the OBS plugin running in an OBS Custom Browser Dock. When you press a button in Companion, the verse appears automatically in OBS.

## Requirements

- Node.js v20 or later installed on the machine running Companion
- OBS Studio with the OBS Bible Companion plugin loaded as a Custom Browser Dock
- The relay server must be running (it starts automatically when this connection is enabled)

## First-Time Setup

1. Run `setup.bat` (Windows) or `setup.sh` (Mac/Linux) from the project folder once
2. In OBS, add a Custom Browser Dock pointing to `http://127.0.0.1:8766/index.html`
3. In OBS, add a Browser Source on your scene pointing to `http://127.0.0.1:8766/browser_source.html`
4. Add this connection in Companion — the relay starts automatically

## Navigation Buttons

The module provides dynamic navigation buttons that update as you navigate:

- **Old Testament / New Testament** — starting buttons
- **Book buttons** — appear after selecting a testament
- **Chapter buttons** — appear after selecting a book
- **Verse buttons** — appear after selecting a chapter
- **Back** — go back one step
- **Reset** — start over from the beginning

When you select a verse, it displays in OBS automatically.

## Control Buttons

- **Show Overlay** — make the verse visible on the OBS scene
- **Hide Overlay** — hide the verse
- **Toggle Overlay** — switch between shown and hidden
- **Next Verse** — advance to the next verse
- **Previous Verse** — go back to the previous verse
- **Display Verse** — display a specific reference (e.g. John 3:16)
- **Change Translation** — switch between available translations
- **Refresh State** — re-sync if anything gets out of step

## Variables

| Variable | Description |
|---|---|
| `reference` | Currently displayed verse (e.g. John 3:16) |
| `translation` | Active translation (e.g. KJV) |
| `overlay_visible` | true or false |
| `connected` | true or false |
| `verse_index` | Numeric index of current verse |

## Troubleshooting

**Connection shows error:** The relay server may have failed to start. Check that Node.js is installed and that no other process is using port 8765.

**Navigation buttons missing:** Disable and re-enable the connection to reload the module.

**Verse appears in dock but not on scene:** Confirm `browser_source.html` is added as a Browser Source on the active scene in OBS.

**More help:** See the full README in the project repository.