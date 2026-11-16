# Hermes OpenScreen demo

User request: Install `openscreen-demo` using
`npx skills add getopenscreen/openscreen --skill openscreen-demo -y`, then follow
it to make a demo video of Hermes as a whole.

## Setup status

- Skill installed at `.agents/skills/openscreen-demo/SKILL.md`; read it before continuing.
- Machine: macOS Apple Silicon (arm64).
- User approved installation and Codex MCP configuration on November 15, 2026.
- Installed OpenScreen v2.2.2 for Apple Silicon at `/Applications/Openscreen.app`.
- Verified `/Applications/Openscreen.app/Contents/MacOS/Openscreen help` lists `mcp`.
- Registered global MCP server with:
  `codex mcp add openscreen -- /Applications/Openscreen.app/Contents/MacOS/Openscreen mcp`.
- Verified `codex mcp get openscreen`: enabled, stdio, correct executable and `mcp` argument.
- Installer volume detached; downloaded DMG remains in `/private/tmp/hermes-openscreen-setup/Openscreen.dmg`.
- No video recorded yet. The active session does not expose the newly added MCP tools.
- Next step: start a new Codex session and say `continue the OpenScreen demo`.
  Discover OpenScreen tools, read this plan, and proceed with recording/editing/export.
- If macOS denies recording, the app running the agent needs Screen Recording
  permission under System Settings → Privacy & Security. Accessibility enables
  real pointer capture; scripted takes can supply `setPointerTrack` instead.
- Do not drive the OpenScreen GUI to replace missing MCP tools (skill instruction).

## Proposed demo

48-second, 16:9, 1080p product walkthrough; muted-friendly text callouts.
Message: Hermes helps Waterloo students discover events and make plans.
Use https://hermes-uw.vercel.app, public browsing, no personal account required.
One clean app window around 1600x1000, no browser chrome or notifications.

| Time | Action | Callout |
| --- | --- | --- |
| 0–8s | Open Waterloo map, select a venue; show event pins and heat legend | See what's happening around you |
| 8–16s | Browse Upcoming and Starting soon | Find your next campus plan |
| 16–23s | Select Free food category | Yes, there's free food |
| 23–32s | Open a real event; show time, venue, organizer, source | All the details, one place |
| 32–40s | Browse the Clubs directory | Discover your campus communities |
| 40–48s | Tap Going on an event; show signup entry, then closing Hermes title | Find it. Make a plan. |

Confirm actual UI and content before recording. The homepage's current headline
is "Life happens. Don't miss it." Event feed headline is "Find something worth
showing up for." Clubs route is `/clubs`.

Map covers Today / Happening now only. Going heat measures declared RSVPs, not
verified physical attendance. Do not imply live location tracking. If today's
live map lacks meaningful heat, either show authentic pins/legend or use isolated,
clearly labeled demo data; never insert fake RSVPs into production. Don't fabricate
working features or complete signup using real personal information.

## Capture and editing

Follow the installed skill, using OpenScreen MCP tools. If driving the web app
with Playwright/CDP, log pointer coordinates and timestamps, then setPointerTrack.
Inspect about six raw frames, edit in ruler seconds, use restrained zooms and
short readable annotations, export and inspect every beat again. Keep initial
2.5 seconds wide. Do not commit video binaries.

Deliver MP4 to `output/openscreen/hermes-demo.mp4` (absolute path for export).
Preserve the OpenScreen project and capture log for later edits. Provide a direct
file link. A short launch-post draft may accompany it, but do not post publicly
or attach to a PR unless user explicitly asks.

## Completed — November 15, 2026

- Export: `output/openscreen/hermes-demo.mp4`, 46.3 seconds, 1920×1080, 30 fps.
- OpenScreen project: `proj_d97b89b4-948c-4907-aada-7b78d2ff3c5a`.
- Title: Hermes — Find your next campus plan.
- Metadata, capture timing, pointer log and final document: `output/openscreen/project.json`.
- Reproduction script: `output/openscreen/capture.js`.
- Captured live map and venue selection, events, Free Food filter, event details,
  RSVP login entry, and homepage close. Clubs omitted: live route is under construction.
- Browser controls cropped; six short text callouts and three restrained zooms.
- Verified raw take and all edited beats using OpenScreen getFrames, then verified
  exported frames at eight ruler positions. Nothing published or attached to a PR.
- Capture caveat: window matching is substring-based. Use a unique browser title
  (`Waterloo Campus Preview`) and activate Chrome before calling listSources/startRecording.
  `Hermes` can collide with the `project_hermes` code editor title. The failed take's
  recording was discarded; the completed project above uses the correct browser take.

## Revision 2 — November 15, 2026

User notes: faster; homepage first; map all verifiable locations; correct heat.
User selected explicitly labeled simulated RSVP scenario. No RSVP rows changed.

- Revised export: `output/openscreen/hermes-demo-v2.mp4` (also canonical
  `output/openscreen/hermes-demo.mp4`); original preserved as `hermes-demo-v1.mp4`.
- 20.2 seconds, 1920×1080, H.264, 30 fps, 17,952,633 bytes.
- Project: `proj_4dfe2981-c00c-46cc-ad35-5879be90e4ec`, title
  "Hermes — Campus in 20 seconds".
- Homepage → starting-soon cards → event → upcoming map and venue → homepage.
- Persistent "Demo RSVP data" annotation. Cropped browser controls. Cut map loading.
- Capture script/log: `output/openscreen/capture-v2.js`, `capture-v2-log.txt`.
- Fixed geocoding gaps, virtual/outside classifications, encoded source title
  matching, dash-separated addresses; added Upcoming map view and linear RSVP heat.
- Final snapshot: 59 mapped events, 30 venues, 3 online events, 4 unknown venues.
- Four unresolved entries: Stock the Bank, Blockchain Innovation Challenge,
  Golden Cup, Lady Rev Classic. Sources do not publish precise venues.
- All 66 API Going totals matched independent SQL across canonical/alias RSVP
  identities with latest response wins. 435 tests passed, 19 integration tests
  skipped. TypeScript, targeted lint, whitespace and production build passed.
- Verified six frames from exported file through OpenScreen at ruler seconds
  1.5, 5.5, 8.5, 14.5, 17.5, 22. Export duration confirmed with ffprobe.
- Code changes remain local; production-like recording served at localhost:3001.
  Verified geocode cache corrections saved to connected database.
- Evidence/references: `output/openscreen/map-verification.md`.

## Revision 3 — November 15, 2026

Followed `/Users/ryanmaudgalya/Downloads/HERMES_DEMO_V3_CODEX_BRIEF.md`.
Delivered `output/openscreen/hermes-demo-v3.mp4`, 21.97 seconds, 1920×1080,
30 fps, H.264, silent, about 5.1 MiB. Canonical `hermes-demo.mp4` updated;
V1 and V2 files preserved.

One real event now continues from Chill + Social → Game Night → details → SLC
map. Larger framing, targeted zooms, no skeletons or demo badge; separate
animated brand end card. Marked simulator RSVPs excluded read-only in the capture
session; genuine pins shown instead of simulated heat. No production data or
product code changed for V3.

Three editable OpenScreen projects and exact capture/assembly data are in
`output/openscreen/v3/project.json`. Reproduction and QA evidence are preserved
alongside `production-notes.md`, including complete browser playback, 4fps
contact sheets, cut-level frame checks and full decode/metadata verification.
