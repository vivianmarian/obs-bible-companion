markdown# OBS Bible Companion

Display Bible verses in OBS Studio using Bitfocus Companion button presses — no typing required during a live church service.

---

## What This Does

A church operator presses buttons on a Bitfocus Companion control surface (or the Companion web interface) to navigate the Bible step by step:
Old Testament → Genesis → Chapter 1 → Verses 1–10 → Verse 1

When a verse is selected, it appears automatically on the OBS scene. The operator can then show or hide the overlay, advance to the next verse, or go back — all from Companion buttons, with no keyboard required.

The RelayServer that connects Companion to OBS starts automatically when the Companion module is active — no separate terminal window needed.

---

## System Requirements

| Software | Version | Download |
|---|---|---|
| Node.js | v20 or later | https://nodejs.org |
| OBS Studio | Any recent version | https://obsproject.com |
| Bitfocus Companion | v4.3 or later | https://bitfocus.io/companion |

---

## First-Time Setup

### Windows

Double-click **`setup.bat`** in the project folder. It will:

1. Check Node.js is installed
2. Install all dependencies
3. Generate the Bible structure file
4. Build the OBS plugin HTML
5. Build the Companion module

When it finishes, it prints the exact path to enter in Companion's Developer modules path setting.

### Mac / Linux

```bash
chmod +x setup.sh   # first time only
./setup.sh
```

### What to do after setup

1. Open the **Bitfocus Companion Launcher**, click the cog icon, and set **Developer modules path** to the `project-b` folder inside this repo (the setup script prints the exact path).
2. Restart Companion if it was already open.
3. Continue with the OBS Setup steps below.

Run setup again any time you add a new Bible translation.

---

## OBS Setup

### Step 1 — Add the plugin UI as a Custom Browser Dock

In OBS: **View → Docks → Custom Browser Docks**

Click **+** and fill in:

| Field | Value |
|---|---|
| Dock Name | OBS Bible Companion |
| URL | `http://127.0.0.1:8766/index.html` |

> **Important:** This MUST be a Custom Browser Dock — not a Browser Source.
> Docks stay loaded across scene changes. A Browser Source would disconnect
> the bridge whenever you switch scenes.
>
> The HTTP server starts automatically when Companion loads the OBS Bible module.
> No file paths needed.

### Step 2 — Add the verse display to your scene

In OBS, on the scene where you want verses to appear:

1. Click **+** in the Sources panel → **Browser**
2. Name it "Bible Verse" (or anything you like)
3. Set the URL to `http://127.0.0.1:8766/browser_source.html` (uncheck Local file if checked)
4. Set width and height to match your canvas (e.g. 1920 × 1080)
5. Click OK

### Step 3 — Add the Companion module

In Bitfocus Companion:

1. Go to **Connections** → **Add connection**
2. Search for **OBS Bible** and select it
3. Leave Host as `127.0.0.1` and Port as `8765` (defaults)
4. Click **Save**

The connection status will show **OK** automatically — the RelayServer starts inside the module, no separate terminal needed.

---

## Typical Service Workflow

1. **Before the service:**
   - Open Bitfocus Companion (the relay starts automatically)
   - Open OBS Studio
   - Confirm the OBS Bible connection in Companion shows **OK**
   - Confirm the Custom Browser Dock is loaded in OBS

2. **During the service:**
   - Press **Old Testament** or **New Testament** on your Companion surface
   - Navigate through Books → Chapters → Verses using the dynamic buttons
   - When you reach the verse, it displays automatically on the OBS scene
   - Press **Show Overlay** to make it visible to viewers
   - Press **Hide Overlay** when done
   - Use **Next** / **Previous** to move between verses without re-navigating

3. **After the service:**
   - Close OBS and Companion as normal
   - No relay terminal to close — it stops with Companion

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
| Display Verse | Display a specific reference (e.g. John 3:16) |
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
   - Genesis = 1, Exodus = 2 … Malachi = 39
   - Matthew = 40, Mark = 41 … Revelation = 66

2. Run setup again:

   **Windows:** double-click `setup.bat`

   **Mac/Linux:** `./setup.sh`

3. In OBS, right-click the Companion dock → **Reload**.

The new translation will appear in the dock's translation selector and in the Change Translation Companion action.

---

## Manual End-to-End Testing

These scripts let you test the full system without a Bitfocus Companion device. They live in `project-b/test-scripts/`.

### Test the relay only (no OBS needed)

Start the relay first — either by opening Companion with the module active, or for relay-only testing, run in a terminal:
npm run start:relay --workspace=project-b

Then open two terminals in `project-b/test-scripts/`:

**Terminal A:**
node test-browser.js
Wait for `[test-browser] Connected as browser.`

**Terminal B:**
node test-companion.js

**Expected output in Terminal B:**
[test-companion] Connected as companion.

[test-companion] SENDING: {"type":"displayVerse","reference":"John 3:16"}

[test-companion] RECEIVED: {"connected":true,"currentReference":"John 3:16",...}

[test-companion] Test complete — closing.

### Test with real OBS

1. Open Companion with the module active (relay starts automatically)
2. Open OBS with the Companion dock loaded
3. Wait for Companion connection to show **OK**
4. In `project-b/test-scripts/`, run:
node test-companion.js
5. The verse `John 3:16` should appear in the OBS dock
6. Run:
node test-show-overlay.js
7. The verse should appear on the OBS video output

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Companion shows connection error | Module not loaded or relay failed to start | Check Companion's module log for errors. Confirm Developer modules path points to the `project-b` folder. Re-run `setup.bat` / `setup.sh` if `dist/main.js` is missing. |
| Dock shows blank page | `index.html` not built, or wrong URL | Re-run `setup.bat` / `setup.sh`, then reload the dock. Confirm the dock URL is `http://127.0.0.1:8766/index.html`. |
| Search returns no results | Bible data not inlined correctly | Re-run `setup.bat` / `setup.sh`, reload the dock. |
| Verse appears in dock but not on scene | `browser_source.html` not added as Browser Source | Add `project-a\src\browser_source.html` to your scene. |
| Overlay does not appear on video | Show Overlay not pressed | Press Show Overlay in Companion, or run `node test-show-overlay.js`. |
| Port 8765 already in use | Another process using the port | Change the Relay Port in the Companion connection settings. Set `OBS_BIBLE_PORT` in the environment if starting the relay manually. |
| `bible_structure.json` not found warning | Metadata not generated | Re-run `setup.bat` / `setup.sh`. |
| Navigation buttons missing in Companion | Module not connected or `dist/main.js` missing | Check Companion connection shows OK. Re-run `setup.bat` / `setup.sh` to rebuild the module. |
| Verses display but state not updating | Bridge disconnected and reconnecting | Reload the OBS Custom Browser Dock. State re-syncs on reconnect. |
| `EBADENGINE` warnings during setup | Node v24, packages tested on 20/22 | Safe to ignore — these are warnings only, not errors. |

---

## Security

The RelayServer listens on `127.0.0.1` (localhost) only — it is not reachable from other devices on the network. No authentication is required. This is intentional and appropriate for a single production machine where the operator controls all running software.

If you need to run Companion on a different machine from OBS, change the Relay Host in the Companion connection settings to the Companion machine's IP address, and ensure your network firewall allows connections on port 8765.

---

## Running Tests
npm test --workspace=project-a   # 50 tests — search, display, overlay

npm test --workspace=project-b   # 178 tests — relay, navigation, companion layer

All tests must pass before committing changes. The CI pipeline runs both suites automatically on every push to `main`.

---

## Project Structure
obs-bible-companion/

├── setup.bat                        Windows: run once to set everything up

├── setup.sh                         Mac/Linux: run once to set everything up

├── start.bat                        Windows: informational — relay auto-starts in Companion

├── start.sh                         Mac/Linux: informational — relay auto-starts in Companion

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

├── companion/

│   ├── manifest.json            Required by Companion 4.x module loader

│   └── HELP.md                  Required alongside manifest.json

├── dist/                        GENERATED — compiled module entry point

│   └── main.js

├── test-scripts/                Manual testing tools (no Companion needed)

│   ├── test-browser.js

│   ├── test-companion.js

│   └── test-show-overlay.js

└── src/

├── index.ts                 Module entry point — starts relay in init()

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

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OBS_BIBLE_PORT` | `8765` | Port the RelayServer listens on. Change this if 8765 is already in use on your machine. |

The port is normally set via the Relay Port field in the Companion connection settings. The environment variable is only needed when running the relay manually for development or testing.

---

## Known Issues and Limitations

**Bible data is a stub (88 verses)**
The included `KJV.json` covers only Genesis 1, John 3, and Revelation 22 — 88 verses total. This is sufficient for development and testing. To use the system in a real service, replace `KJV.json` with a full translation file following the format described in "Adding a New Bible Translation" above.

**Navigation shows only books present in bible_structure.json**
The navigation buttons are generated entirely from the data files. If a book has no verses in any translation JSON file, it will not appear as a navigation option. This is by design — no Bible data is hardcoded.

**OBS CEF delivers WebSocket messages as Blob objects**
This is a known quirk of OBS's embedded Chromium environment. The `companion_bridge.js` file handles this correctly by converting Blob data to text before parsing. If you ever modify `companion_bridge.js`, do not add a `typeof event.data !== 'string'` guard — it will silently discard all incoming commands.

**Node v24 EBADENGINE warnings**
`@companion-module/base` and `@companion-module/tools` were tested against Node 20 and 22. Running on Node v24 produces engine compatibility warnings during `npm install`. These are warnings only — the packages install and function correctly on Node v24.

---

## Developer Notes

### Why wscat is not used for testing
`wscat` was found to be unreliable on Windows/PowerShell in this environment — typed commands frequently produced no server-side response. All manual testing uses the Node.js scripts in `project-b/test-scripts/` instead.

### Why companion_bridge.js is a plain IIFE, not an ES module
OBS's embedded Chromium blocks ES6 `import` statements on `file://` URLs with a CORS error. All JavaScript loaded by OBS HTML files must be plain inline scripts with no `type="module"`. The `.js` source files in `project-a/src/js/` are ES modules used only by the Jest test suite.

### Why bible data is inlined into index.html at build time
OBS's embedded Chromium also blocks `fetch()` calls on `file://` URLs. The build script (`scripts/build-html.cjs`) inlines all translation JSON data directly into `index.html` as a JavaScript variable at build time.

### Why the relay is embedded in the Companion module
In earlier versions the relay was a separate process started via `start.bat`. This required the operator to remember to start it before every service. The relay now starts automatically inside the Companion module's `init()` method and stops in `destroy()` — no separate terminal needed.

### Changing the default port
Set the Relay Port in the Companion connection settings UI. Or set the `OBS_BIBLE_PORT` environment variable when running the relay manually for development.

### CI pipeline
GitHub Actions runs both test suites on Node 20 and Node 22 on every push to `main`. See `.github/workflows/ci.yml`.

---

## Acknowledgements

Original OBS Bible Plugin concept by [Tosin-JD](https://github.com/Tosin-JD/obs-bible-plugin). This project is a ground-up rewrite with a programmatic API, Bitfocus Companion integration, and automated test coverage, written independently under separate ownership.

---

*OBS Bible Companion — built for El-Bethel Church*