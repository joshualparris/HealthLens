# Gentle Motion — reusable physiotherapy companion

Engineering principles: v5.1. Assurance tier: 3 when handling health data.
Canonical reusable source: joshualparris/HealthLens, gentle-motion/.

This is the privacy-safe source distribution. It contains **no personal prescriptions, patient documents or progress**. The separate owner-private Sites deployment carries its own private configuration. Never copy its data.js or prescriptions/ into this public repo. Sites is a configured distribution, not an independent source of feature development.

Serve this directory with a static HTTP server for development. Deploy on HTTPS for service workers, installation and microphone support. No dependencies or build step. Run `node --test gentle-motion/domain.test.mjs` from the repository root.

The public template deliberately starts unconfigured and blocks exercise sessions until a routine is added or a dated JSON archive is imported. Import from Programmes → Import dated exercise programmes. Custom routines can be entered in Library. For clinician presets, supply a private data.js module using the documented exercise fields and host with owner-only access. Fields: name, text, reps (optional), sides (optional), hold (seconds, optional), each (hold each repetition), ambiguous (disables automatic hold scheduling), clarify, area. Programme expiresOn is a Sydney calendar date. Missing dosage stays unspecified. Original PDFs must only be provisioned on authenticated private hosting.

## Functionality
One exercise per screen; speech synthesis; opt-in browser speech recognition and explicit voice completion confirmation; repetition counters; hold timers; pause/reload recovery; history and self-reported comfort; CSV exports; JSON backup; PDF storage in IndexedDB; optional foreground reminders. No inferred movement detection, automatic progression, account sync or background push/email service.

Progress uses localStorage `gentle-motion-v1`; uploaded PDFs use IndexedDB `gentle-motion-files`. JSON backups exclude PDFs. Browser clearing removes local data. Voice providers may receive audio when recognition is explicitly enabled. No analytics.

## Evidence and remaining gates
Private configured build: automated dose/hold/expiry/command tests passed. Desktop browser exercised all active rotation counts, real hold elapsed time, pause/reload/resume and manual completion. Android microphone, offline restart, notification delivery and install remain unverified. Illustrations are schematic movement cues; insufficiently specified techniques show a clarification message. This is not a clinically validated movement demonstrator.

This source addition is isolated from the existing HealthLens Vite application and does not alter its build or deployment. Roll back by reverting the additive commit. Do not claim the entire app meets the Tier 3 release bar until backup/restore, multi-tab concurrency and device checks have been completed.

Historical exercise programmes should remain clearly dated, and general educational material must not be presented as a current clinician prescription.

## Importing a dated exercise archive
Use a JSON file with `version: 1`, a `programmes` array containing `name`, `date` (YYYY-MM-DD), `source`, `frequency`, `precaution`, `exercises` (`name`, `text`, optional `reps`, `hold`, `sides`, `each`, `ambiguous`, `visual`, `area`), and optional `advice` entries (`date`, `title`, `text`, `source`, `area`). The newest programme should be first. The importer validates ranges, keeps undosed exercises undosed, and stores the archive in this browser only. Follow a current clinician-approved plan; historical plans remain dated and separate. No imported health information is transmitted by the app.

## Loading a dated email archive
Open **Programmes → Import dated exercise programmes**, select a JSON file and confirm. The file should contain `version: 1`, `programmes` (each with a name, ISO date, source, optional dosage fields, and an exercises array), plus optional `advice` entries. Imported programmes are saved to browser storage. Dated records remain separate and advice has its own tab. Unknown doses are left unspecified; a new programme should not be assumed to supersede your physiotherapist's instructions.
