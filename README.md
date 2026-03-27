# RU (Resistance Utility)

A lightweight Electron overlay that helps you start tasks when you're feeling resistance. Trigger it with a hotkey, commit to 90 seconds, and see if momentum carries you forward.

---

## Installing (Windows)

1. Download `RU Setup 1.0.0.exe` from the latest GitHub Actions build
2. Run the installer — Windows SmartScreen may warn "unrecognized app"
   - Click **More info** → **Run anyway**
3. RU starts automatically after install

---

## Installing (Mac)

### Step 1 — Open the app

1. Download the correct DMG for your Mac:
   - **Apple Silicon (M1/M2/M3):** `RU-1.0.0-arm64.dmg`
   - **Intel Mac:** `RU-1.0.0.dmg`
2. Open the DMG and drag RU to your Applications folder
3. Try to open RU — macOS will block it with "cannot be opened because Apple cannot check it for malicious software"
4. Go to **System Settings → Privacy & Security** → scroll down → click **Open Anyway** next to RU
5. Confirm by clicking **Open** in the dialog

### Step 2 — Grant Accessibility permission (required for R+U hotkey)

The R+U global hotkey requires Accessibility access. Without it the widget shows up but the hotkey does nothing.

1. On first launch, RU will open System Settings automatically
2. Go to **System Settings → Privacy & Security → Accessibility**
3. Find **RU** in the list and toggle it **on**
4. **Restart the app** — the hotkey will not work until you restart

> If you dismissed the prompt and the hotkey isn't working, manually go to System Settings → Privacy & Security → Accessibility and add RU.

### Step 3 — Install the Chrome extension (optional, for tab blocking)

The Chrome extension is not on the Web Store yet. To install it manually:

1. Download the `extension` folder from this repo (or the release)
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `extension` folder
5. The RU Blocker extension is now active

> To allow blocking in Incognito: click the RU extension → Details → Allow in Incognito

---

## How It Works

**Global hotkey:** Hold `R + U` anywhere on your computer to summon the overlay.

### Flow

```
[Welcome] → [90s Sprint] → [Post-Sprint] → [Review] → [Done]
                ↓
           (widget mode — shrinks to corner)
```

1. **Welcome** — Type what you'll focus on, then hit Enter or "Start 90 seconds"
2. **Sprint** — Window shrinks to a small corner widget showing the countdown
3. **Post-Sprint** — Did you start? Keep going or end the session
4. **Review** — Rate the session, then done

---

## Status Icon Widget

A small **RU** dot lives in the corner of your screen at all times. Click it to expand your daily stats:

- **Locked In score** (0–100)
- Sessions started, minutes focused, avg time to begin, bails
- **Blocked Sites** — add/remove domains from the block list
- Quit RU button

The widget syncs the block list with any connected Chrome extensions automatically.

---

## Browser Tab Blocking

The Chrome extension blocks distracting sites with two modes:

- **Soft block** (outside sessions) — "RU avoiding something?" with a first-step prompt to launch a session
- **Hard block** (during sessions) — "Session in progress. Stay with it."

The block list is managed from the RU widget and syncs to all connected browsers. During a session, the block list and toggle are locked.

---

## Stack

- **Electron** v41 — app shell, frameless window, IPC
- **uiohook-napi** v1.5 — global keyboard hook
- **ws** — WebSocket server for extension bridge
- Vanilla JS / HTML / CSS

---

## Running from source

```bash
npm install
npm start
```

## Building

```bash
npm run dist
```

Or push to `main` — GitHub Actions builds Windows and Mac automatically.
