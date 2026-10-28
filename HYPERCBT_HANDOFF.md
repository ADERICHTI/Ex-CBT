# Hand-off: ex-cbt becomes **HyperCBT**, part of Quality Tools

From the PeraForm session, on the user's instructions (2026-10-28). Read all
of this, then **ask the user the questions in section 4 before changing any
code.**

## 1. What the user decided

- **ex-cbt is renamed HyperCBT.**
- HyperCBT **moves under Quality Tools (QT)**, the user's suite of apps.
  PeraForm is QT's data-collection app (forms); **HyperCBT is QT's assessment
  app** — it focuses on the best possible quality of assessment.
- HyperCBT takes the **QT design system** and the **QT app structure**, the
  way PeraForm has them:
  - the **dashboard** (start row, list of the user's items, search) — like
    PeraForm's forms dashboard;
  - each **project's page** — in PeraForm a project is a *form*; in HyperCBT
    it's the CBT equivalent (exam/assessment) — laid out like PeraForm's form
    page (top bar with title, status/publish, tabs, settings);
  - **templates on the dashboard**;
  - **Create with AI** on the dashboard.

## 2. The reference: PeraForm

Repo: `C:\Users\IAR\Documents\code\peraform` (Vite + React + Firebase,
project `quality-toolsx`). Look at, don't copy blindly:

| Area | Where in PeraForm |
|---|---|
| App frame (top bar, drawer on phones, content card, footer) | `src/lib/AppShell.jsx`, `AppShell.css` |
| Design tokens, light/dark theme | `src/index.css`, `src/lib/theme.js`, `src/lib/useTheme.js` |
| Shared UI: dropdown, menus, confirm dialog, toasts, colour picker | `src/lib/Select.jsx`, `MenuButton.jsx`, `ConfirmModal.jsx`, `useToast.jsx`, `ColorPicker.jsx` |
| Dashboard (start row: Blank, Create with AI, templates; list; search) | `src/features/dashboard/DashboardPage.jsx`, `templates.js` |
| Project page layout (form editor: top bar, tabs, publish status) | `src/features/builder/FormLayout.jsx`, `BuilderActions.jsx` |
| Create with AI (streaming progress, cancel, credit hold) | `src/features/ai/GenerateFormDialog.jsx`, `useAiRun.js`, `AiParts.jsx`; server `functions/ai/*`, `functions/billing/functions.js` (`aiRun`) |
| AI credits (one wallet for all QT apps) | `functions/billing/*`, `src/features/credits/*`, `billing` database |
| Keep (saved items shared across QT apps) | `src/lib/keep.js`, `src/features/keep/*`, `suite` database, `firestore.suite.rules` |
| QT product site | `C:\Users\IAR\Documents\code\quality-tools` (pages per app) |

Firebase project `quality-toolsx` uses **one named database per app**
(`peraform`, plus suite-wide `billing` and `suite`), one storage bucket, hosting
site and functions codebase per app.

## 3. The user's standing rules (apply to HyperCBT too)

- **No automatic changes to user content.** Detect, explain, offer a button.
  Any new "automatic" behaviour needs a planning session with the user first.
- **Every delete/remove/reject button** asks "are you sure?" (ConfirmModal).
- **The user deploys**; you give the exact commands and list which repos/files
  changed. Never paste or ask for secrets — the user sets them in a terminal.
- **Scrollbars:** VS Code size (14px track, ~8px rounded grey thumb) — never
  thin or custom-coloured.
- **No native `<select>`** lists in the UI — use the app's own dropdown.
- Explicit notices, so the user never thinks the app is broken.
- Plain, friendly wording for users; no jargon.
- Check this repo's own `claude.md` for its git rules (PeraForm: commit,
  never push).

## 4. Ask the user first (before building)

Ask these, briefly, with your recommendation for each:

1. **Firebase:** move HyperCBT into the `quality-toolsx` project (own named
   database, bucket, hosting site, functions codebase — like PeraForm), or stay
   where it is now? Existing data/users: migrate, or start fresh?
2. **Accounts:** share sign-in with the other QT apps (one account across
   PeraForm, HyperCBT…)? That follows from moving into `quality-toolsx`.
3. **Brand colour:** keep HyperCBT's orange-amber (`#EA7A10`) as its own
   accent inside the QT design, or something else? (PeraForm is indigo.)
4. **The "project" in HyperCBT:** what's the unit on the dashboard — an exam,
   a question bank, a course? What are its tabs (e.g. Questions, Settings,
   Candidates, Results)?
5. **Templates:** which exam templates should the dashboard offer?
6. **Create with AI:** what should it create — a full exam from a topic,
   questions from pasted notes/a syllabus, marking schemes? Paid with the same
   QT AI credits (shared wallet)?
7. **Name and address:** web address/hosting site name (e.g. `hypercbt`), and
   should the QT product site get a HyperCBT page?
8. **What stays:** which current ex-cbt features/screens must be kept as they
   are (e.g. the candidate exam-taking screens)?
9. **Order of work:** rename + design first, then dashboard/project page, then
   templates and AI — or another order?

Then write a short plan back to the user and get a yes before coding.

## 5. Notes

- The memory note for this app said: minimal "mnldsg" design, orange-amber
  brand, no left-side panels, nav in the top bar. The QT design is similar
  (top bar nav, drawer only on phones) — confirm with the user what changes.
- Keep the user informed in short updates; report what you tested and what
  you didn't.

## 6. Decisions (answered by the user, 2026-10-28)

1. **Firebase:** move to `quality-toolsx` (own named database, bucket, hosting
   site, functions codebase, App Check key; europe-west1). Shared QT sign-in.
2. **Old data:** start fresh. Leave the old quick-cbt site up for a while so
   past results can be downloaded, then retire it (each delete confirmed).
3. **Brand colour:** keep orange-amber `#EA7A10` inside the QT design.
4. **Main item:** a **test** (word used everywhere: "New test", "My tests").
5. **Test page tabs:** Questions / Candidates / Results / Settings.
6. **Templates:** blank test + quick quiz; school subjects; exam formats
   (mid-term, end-of-term, mock, entrance/aptitude); work/training.
7. **Create with AI** (shared QT credits wallet via `aiRun`):
   full test from a topic; questions from pasted notes/syllabus;
   explanations per question; difficulty mix with tags;
   **review before publishing** (suggestions, an Apply button each);
   **analyse results after** (plain-language report on Results);
   **result statistics** (per-question stats). The user wants PeraForm to get
   the results analysis/statistics too — passed to the PeraForm session.
8. **Address:** `hypercbt-qt.web.app`. HyperCBT page on the QT product site
   comes last.
9. **Keep as-is (restyled only):** candidate test-taking flow (start page,
   timer, navigator, strict mode, single attempt); server-side grading and
   hidden answer key/approved list; CSV upload + spreadsheet editors;
   sign-in options. **Add** PeraForm's in-page Google sign-in / One Tap
   (commit 22fa175) and PeraForm's other UX features (theme toggle, toasts,
   ConfirmModal, own dropdowns, Keep, account menu, credits chip, etc.).
10. **Order:** staged — move+rename+QT design → dashboard + test page →
    templates → AI create + review → results analysis/stats → QT site page.
11. **Shared with PeraForm (results analysis):** PeraForm specs the same
    feature in `peraform/guide.md` Part 6 (memory "peraform-results-analysis"):
    free per-question stats; AI "Analyse results" via `aiRun` sending
    aggregated stats only (never free-text answers or emails); optional
    review-before-publish with Apply per suggestion. Whichever app builds it
    first keeps stats helpers pure in `src/lib/` and AI features in
    `functions/ai/catalog.js` + `features.js`, then tells the other session
    where they live.
