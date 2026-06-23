# OBS Bible Companion

Display Bible verses in OBS Studio using Bitfocus Companion button presses — no typing required during a live church service.

---

## What This Does

A church operator presses buttons on a Bitfocus Companion control surface (or the Companion web interface) to navigate the Bible step by step:

```
Old Testament → Genesis → Chapter 1 → Verses 1–10 → Verse 1
```

When a verse is selected, it appears automatically on the OBS scene. The operator can then show or hide the overlay, advance to the next verse, or go back — all from Companion buttons, with no keyboard required.

---

## System Requirements

| Software | Version | Download |
|---|---|---|
| Node.js | v20 or later | https://nodejs.org |
| OBS Studio | Any recent version | https://obsproject.com |
| Bitfocus Companion | v3 | https://bitfocus.io/companion |

---

## First-Time Setup

### 1. Install dependencies

Open a terminal in the project folder and run:

```
npm install
```

### 2. Generate the Bible structure file

```
npm run generate:metadata --workspace=project-b
```

This reads the translation JSON files and produces `project-a/src/bible_data/bible_structure.json`. Run this again any time you add a new translation.

### 3. Build the plugin UI

```
npm run build --workspace=project-a
```

This inlines the Bible data into `project-a/src/index.html`. Run this again any time you add a new translation.

### 4. Verify everything works

```
npm test --workspace=project-a
npm test --workspace=project-b
```

Both suites should pass with no failures.

---

## OBS Setup

### Step 1 — Add the plugin UI as a Custom Browser Dock

In OBS: **View → Docks → Custom Browser Docks**

Click **+** and fill in:

| Field | Value |
|---|---|
| Dock Name | OBS Bible Companion |
| URL | Full path to `project-a/src/index.html` |

**Windows example:**
```
C:\Users\YourName\obs-bible-companion\project-a\src\index.html
```

**Mac example:**
```
/Users/YourName/obs-bible-companion/project-a/src/index.html
```

> **Important:** This MUST be a Custom Browser Dock — not a Browser Source.
> Docks stay loaded across scene changes. A Browser Source would disconnect
> the bridge whenever you switch scenes.

### Step 2 — Add the verse display to your scene

In OBS, on the scene where you want verses to appear:

1. Click **+** in the Sources panel → **Browser**
2. Name it "Bible Verse" (or anything you like)
3. Check **Local file** and browse to `project-a/src/browser_source.html`
4. Set width and height to match your canvas (e.g. 1920 × 1080)
5. Click OK

### Step 3 — Add the Companion module

In Bitfocus Companion:

1. Go to **Connections** → **Add connection**
2. Search for **OBS Bible** and select it
3. Leave Host as `127.0.0.1` and Port as `8765` (defaults)
4. Click **Save**

The connection status will show **OK** once the RelayServer is running (see next section).

---

## Starting the System

### Windows

Double-click **`start.bat`** in the project folder.

A terminal window will open and show:
```
[RelayServer] Listening on 127.0.0.1:8765
```

Keep this window open for the entire service.

### Mac / Linux

Open a terminal in the project folder and run:

```bash
chmod +x start.sh   # first time only
./start.sh
```

You should see:
```
[RelayServer] Listening on 127.0.0.1:8765
```

Keep this terminal open for the entire service.

---

## Setting Up Companion Buttons

### Navigation buttons (auto-updating)

When the module loads, Companion will show buttons for the first navigation step (Old Testament / New Testament). As you press buttons, the page updates automatically to show the next set of choices — Books, then Chapters, then Verses. When a verse is selected, it displays on the OBS scene automatically.

The navigation action IDs available on the initial page are:

| Action ID | What it does |
|---|---|
| `nav_Old` | Select Old Testament |
| `nav_New` | Select New Testament |
| `nav_nav_back` | Go back one step |
| `nav_nav_reset` | Start over from Testament selection |

After selecting a testament, the page rebuilds to show book buttons. After selecting a book, chapter buttons appear, and so on.

### Static control buttons

These actions are always available from any navigation page:

| Action | What it does |
|---|---|
| Show Overlay | Make the verse visible on the OBS scene |
| Hide Overlay | Hide the verse from the OBS scene |
| Toggle Overlay | Switch between shown and hidden |
| Next Verse | Advance to the next verse |
| Previous Verse | Go back to the previous verse |
| Display Verse | Display a specific reference (type it in, e.g. John 3:16) |
| Change Translation | Switch between KJV, NIV, etc. |
| Refresh State | Re-sync state after a reconnect |

### Button text variables

Show live information on your buttons using these variables (replace `obsbible` with your connection's label if you named it differently):

| Variable | Shows |
|---|---|
| `$(obsbible:reference)` | Currently displayed verse (e.g. John 3:16) |
| `$(obsbible:translation)` | Active translation (e.g. KJV) |
| `$(obsbible:overlay_visible)` | true or false |
| `$(obsbible:connected)` | true or false |
| `$(obsbible:verse_index)` | Numeric index of current verse |

### Feedbacks

| Feedback | Highlights when |
|---|---|
| Overlay Is Visible | The verse overlay is shown on screen — green |
| Bridge Connected | OBS is NOT connected — red (use as a warning indicator) |
| Current Reference Is | The displayed verse matches a configured reference — green |
| Current Translation Is | The active translation matches a configured value — green |

---

## Typical Service Workflow

1. **Before the service:**
   - Start OBS
   - Run `start.bat` / `start.sh`
   - Open Bitfocus Companion
   - Confirm the OBS Bible connection shows **OK**

2. **During the service:**
   - Press **Old Testament** or **New Testament** on your Companion surface
   - Navigate through Books → Chapters → Verses using the dynamic buttons
   - When you reach the verse, it displays automatically on the OBS scene
   - Press **Show Overlay** to make it visible to viewers
   - Press **Hide Overlay** when done
   - Use **Next** / **Previous** to move between verses without re-navigating

3. **After the service:**
   - Close the `start.bat` / `start.sh` terminal window
   - Close OBS and Companion as normal

## Adding a New Bible Translation

1. Create a new file in `project-a/src/bible_data/`:

   **Filename:** `TRANSLATIONNAME.json` (e.g. `NIV.json`, `NKJV.json`)

   **Format — one entry per verse:**
   ```json
   [
     { "name": "John 3:16", "verse": "For God so loved the world...", "ari": "43:3:16" }
   ]
   ```

   The `ari` field is `bookIndex:chapter:verse` where:
   - Genesis = 1, Exodus = 2 ... Malachi = 39
   - Matthew = 40, Mark = 41 ... Revelation = 66

2. Regenerate the structure file:
   ```
   npm run generate:metadata --workspace=project-b
   ```

3. Rebuild the plugin UI:
   ```
   npm run build --workspace=project-a
   ```

4. In OBS, right-click the Companion dock → **Reload**.

The new translation will appear in the dock's translation selector and in the Change Translation Companion action.

---

## Manual End-to-End Testing (without Companion)

These scripts let you test the full system without a Bitfocus Companion device. They live in `project-b/test-scripts/`.

### Test the relay only (no OBS needed)

Open two terminals in the `project-b/test-scripts/` folder:

**Terminal A:**
```
node test-browser.js
```
Wait for `[test-browser] Connected as browser.`

**Terminal B:**
```
node test-companion.js
```

**Expected output in Terminal B:**
```
[test-companion] Connected as companion.
[test-companion] SENDING: {"type":"displayVerse","reference":"John 3:16"}
[test-companion] RECEIVED: {"connected":true,"currentReference":"John 3:16",...}
[test-companion] Test complete — closing.
```

This proves the relay forwards messages correctly in both directions.

### Test with real OBS

1. Start the relay (`start.bat` or `start.sh`)
2. Open OBS with the Companion dock loaded
3. Wait for relay to show `[RelayServer] Browser client connected.`
4. In `project-b/test-scripts/`, run:
   ```
   node test-companion.js
   ```
5. The verse `John 3:16` should appear in the OBS dock
6. Run:
   ```
   node test-show-overlay.js
   ```
7. The verse should appear on the OBS video output

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Companion shows connection error | RelayServer not running | Run `start.bat` or `start.sh` |
| Dock shows blank page | `index.html` not built, or wrong file loaded | Run `npm run build --workspace=project-a`, reload dock. Confirm the dock URL ends in `project-a/src/index.html` |
| Search returns no results | Bible data not inlined correctly | Run `npm run build --workspace=project-a`, reload dock |
| Verse appears in dock but not on scene | `browser_source.html` not added as Browser Source | Add `project-a/src/browser_source.html` to your scene |
| Overlay does not appear on video | Show Overlay not pressed | Press Show Overlay in Companion, or run `node test-show-overlay.js` |
| Port 8765 already in use | Old relay process still running | Windows: `Get-Process node \| Stop-Process -Force` then restart. Mac/Linux: `pkill node` then restart |
| `bible_structure.json` not found warning | Metadata not generated | Run `npm run generate:metadata --workspace=project-b` |
| Navigation buttons missing in Companion | Module not connected | Check Companion connection shows OK. Confirm relay is running. |
| Verses display but state not updating | Bridge disconnected and reconnecting | Reload the OBS Custom Browser Dock. State re-syncs on reconnect. |
| `EBADENGINE` warnings during `npm install` | Node v24, packages tested on 18/22 | Safe to ignore — these are warnings only, not errors |

---

## Security

The RelayServer listens on `127.0.0.1` (localhost) only — it is not reachable from other devices on the network. No authentication is required. This is intentional and appropriate for a single production machine where the operator controls all running software.

If you need to run the relay on a different machine from OBS, change the Relay Host in the Companion connection settings to the relay machine's IP address, and ensure your network firewall allows connections on port 8765.

---

## Running Tests

```
npm test --workspace=project-a   # 50 tests — search, display, overlay
npm test --workspace=project-b   # 178 tests — relay, navigation, companion layer
```

All tests must pass before committing changes. The CI pipeline runs both suites automatically on every push to `main`.

---

## Project Structure

```
obs-bible-companion/
├── start.bat                        Windows: double-click to start
├── start.sh                         Mac/Linux: ./start.sh to start
├── package.json                     Root workspace config
├── README.md
│
├── project-a/                       OBS plugin (HTML + JS)
│   ├── scripts/
│   │   ├── index.template.html      Edit this — not src/index.html
│   │   └── build-html.cjs           Inlines bible data into index.html
│   └── src/
│       ├── index.html               GENERATED — load as Custom Browser Dock
│       ├── browser_source.html      Load as Browser Source on your scene
│       ├── css/styles.css
│       ├── js/
│       │   ├── search.js
│       │   ├── display.js
│       │   ├── overlay.js
│       │   ├── translation.js
│       │   └── companion_bridge.js  WebSocket bridge to RelayServer
│       └── bible_data/
│           ├── KJV.json             Bible data — 88 verses in stub
│           └── bible_structure.json GENERATED — do not edit directly
│
└── project-b/                       Companion module + RelayServer
    ├── test-scripts/                Manual testing tools (no Companion needed)
    │   ├── test-browser.js
    │   ├── test-companion.js
    │   └── test-show-overlay.js
    └── src/
        ├── index.ts                 Companion module entry point
        ├── config.ts                Shared config (port, channel names)
        ├── bridge/
        │   ├── RelayServer.ts       WebSocket relay (port 8765)
        │   └── WebSocketClient.ts   Auto-reconnecting WS client
        ├── navigation/
        │   ├── BibleStructure.ts    Type definitions + helpers
        │   ├── NavigationEngine.ts  State machine (Testament→Verse)
        │   └── NavigationController.ts  Builds Companion button pages
        ├── companion/
        │   ├── types.ts             ModuleConfig, BridgeState, BridgeCommand
        │   ├── config.ts            Connection settings fields
        │   ├── actions.ts           8 button actions
        │   ├── feedbacks.ts         4 visual feedbacks
        │   └── variables.ts         5 live variables
        └── metadata/
            └── MetadataGenerator.ts Generates bible_structure.json
```
## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OBS_BIBLE_PORT` | `8765` | Port the RelayServer listens on. Change this if 8765 is already in use on your machine. |

**Windows — set before starting:**
```
set OBS_BIBLE_PORT=9000
start.bat
```

**Mac/Linux — set before starting:**
```
OBS_BIBLE_PORT=9000 ./start.sh
```

If you change the port, update the Relay Port field in the Companion connection settings to match.

---

## Known Issues and Limitations

**Bible data is a stub (88 verses)**
The included `KJV.json` covers only Genesis 1, John 3, and Revelation 22 — 88 verses total. This is sufficient for development and testing. To use the system in a real service, replace `KJV.json` with a full translation file following the format described in "Adding a New Bible Translation" above.

**Navigation shows only books present in bible_structure.json**
The navigation buttons are generated entirely from the data files. If a book has no verses in any translation JSON file, it will not appear as a navigation option. This is by design (Decision 12 — no hardcoded data).

**OBS CEF delivers WebSocket messages as Blob objects**
This is a known quirk of OBS's embedded Chromium environment. The `companion_bridge.js` file handles this correctly by converting Blob data to text before parsing. If you ever rewrite or modify `companion_bridge.js`, do not add a `typeof event.data !== 'string'` guard — it will silently discard all incoming commands (see Decision 29 in the developer notes).

**Node v24 EBADENGINE warnings**
`@companion-module/base` and `@companion-module/tools` were tested against Node 18 and 22. Running on Node v24 produces engine compatibility warnings during `npm install`. These are warnings only — the packages install and function correctly on Node v24.

---

## Developer Notes

### Why wscat is not used for testing
`wscat` (a popular WebSocket CLI tool) was found to be unreliable on Windows/PowerShell in this project's environment — typed commands frequently produced no server-side response with no error output. All manual testing is done via the Node.js scripts in `project-b/test-scripts/` instead. See `project-b/test-scripts/test-companion.js` for the recommended approach.

### Why companion_bridge.js is a plain IIFE, not an ES module
OBS's embedded Chromium blocks ES6 `import` statements on `file://` URLs with a CORS error. All JavaScript loaded by OBS HTML files must be plain ES5-compatible inline scripts or non-module `<script>` tags. The separate `.js` source files in `project-a/src/js/` are ES modules used only by the Jest test suite — they are not loaded by OBS at runtime.

### Why bible data is inlined into index.html at build time
OBS's embedded Chromium also blocks `fetch()` calls on `file://` URLs. Data cannot be loaded at runtime via HTTP requests. The build script (`scripts/build-html.cjs`) inlines all translation JSON data directly into `index.html` as a JavaScript variable, so no network request is needed. This is why you must run `npm run build --workspace=project-a` whenever translation data changes.

### Changing the default port
Edit `project-b/src/config.ts`:
```typescript
relayPort: parseInt(process.env.OBS_BIBLE_PORT ?? '9000', 10),
```
Or simply set the `OBS_BIBLE_PORT` environment variable at startup — no code change needed.

### CI pipeline
GitHub Actions runs both test suites on Node 20 and Node 22 on every push to `main`. See `.github/workflows/ci.yml`. The pipeline also runs `generate:metadata` and `build` to catch any issues with the generated files before they reach a reviewer.

---

## Acknowledgements

Original OBS Bible Plugin concept by [Tosin-JD](https://github.com/Tosin-JD/obs-bible-plugin). This project is a ground-up rewrite with a programmatic API, Bitfocus Companion integration, and automated test coverage, written independently under separate ownership.

---

*OBS Bible Companion — built for El-Bethel Church*