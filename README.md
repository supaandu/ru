# RU (Resistance Utility)

A lightweight Electron overlay that helps you start tasks when you're feeling resistance. Trigger it with a hotkey, commit to 90 seconds, and see if momentum carries you forward.

---

## How It Works

**Global hotkey:** Hold `R + U` anywhere on your computer to summon the overlay.

### Flow

```
[Welcome] → [90s Sprint] → [Post-Sprint] → [3min Extended] → [Done]
                ↓                  ↓
           (widget mode)      (full overlay)
```

1. **Welcome** — Optionally type what you'll focus on, then hit "Start 90 seconds" (or dismiss with "Not now")
2. **Sprint** — Window shrinks to a small corner widget showing the countdown. Do the thing.
3. **Post-Sprint** — Rate your resistance before/after (0–10 sliders). Choose to keep going 3 more minutes or stop.
4. **Extended** — Another compact corner widget for the 3-minute block.
5. **Final** — Session complete screen, then closes.

---

## UI

- Frameless, transparent, always-on-top overlay
- **Normal mode:** 420×360px, centered on screen (welcome / post / final screens)
- **Widget mode:** 200×72px, top-right corner, draggable — active during 90s and 3min timers
- Dark theme (`rgba(22, 27, 34, 0.94)` background)

---

## Data Tracking

Sessions are saved to `sessions.json` in the project directory. Each session records:

| Field | Type | Description |
|---|---|---|
| `timestamp` | ISO string | When the session was triggered |
| `started` | boolean | Whether the user clicked "Start" or dismissed |
| `completed` | boolean | Whether the 90s sprint finished |
| `continued3min` | boolean | Whether the user opted into the extended block |
| `resistanceBefore` | 0–10 or null | Self-reported resistance before starting |
| `resistanceAfter` | 0–10 or null | Self-reported resistance after the sprint |
| `attentionText` | string | What the user said they'd focus on |

**No dashboard or analytics yet** — the data is there but visualization/export hasn't been built.

---

## Stack

- **Electron** v41 — app shell, frameless window, IPC
- **uiohook-napi** v1.5 — global keyboard hook (works outside the app window)
- Vanilla JS / HTML / CSS — no frontend framework

---

## Running

```bash
npm install
npm start
```

---

## File Structure

```
main.js          # Electron main process — window management, keyboard hook, IPC handlers
renderer.js      # UI logic — screen transitions, timer, session state
preload.js       # Context bridge — exposes safe IPC calls to renderer
index.html       # Screen markup (welcome, sprint, post, extended, final)
styles.css       # Styles including widget-mode compact layout
sessions.json    # Persisted session data (auto-created)
```

---

## Potential Next Steps

- Session history viewer / stats dashboard
- Streak tracking
- Configurable timer durations
- Sound/notification when timer ends
- Export sessions to CSV
