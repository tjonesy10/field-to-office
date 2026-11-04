# F001 Daily Field Report (Field-to-Office)

Status: Ready for build. Planner: blueprint. Builder: forge.
Repo: GitHub `tjonesy10/field-to-office`. Docs reach `main` only by PR.
Related: [PRD](../../prd.md) · [Data dictionary](../../data-dictionary.md) · [Architecture](../../architecture.md) · [Process maps](../../process-maps.md)
Terms follow [GLOSSARY.md](../../GLOSSARY.md).

All jobs, people, and reports in this feature are fictional.

## Problem / job to be done

Foremen send daily reports as paper, texts, or photos left on their phones. PMs retype them and catch change-order work and material shortages late. When a foreman submits a daily report, the office should get a structured log, crew hours, filed photos, and flagged items for PM review, with no retyping and no automatic action.

## User stories

- As a **foreman**, I want to submit my daily report from my phone in one form, with photos and a voice note, so that I don't have to call or text the office.
- As a **PM**, I want each report summarized, with crew hours split out and possible change orders and shortages flagged, so that I can catch extra work and order material before it costs us.
- As a **PM**, I want to approve or reject every flag myself, so that nothing goes to a customer or supplier without my review.
- As the **ops/AI manager**, I want every submission logged even when the AI fails, plus a scorecard, so that I can judge the pilot on evidence.
- As the **ops/AI manager**, I want one setup function, so that the demo runs from a fresh account in about 10 minutes.

## Observable behavior

### Inputs: Google Form "Field-to-Office Daily Report"

| Question title (exact) | Type | Required | Notes |
|---|---|---|---|
| Job | Dropdown | Yes | Choices come from the Jobs tab, as `<Job #> - <Job Name>` |
| Foreman name | Short answer | Yes | |
| Report date | Date | No | Blank means the submission date in America/New_York (Forms can't default a date to today) |
| Report text | Paragraph | Yes | |
| Photos | File upload, image, multiple (max 10) | No | Added by hand, see Setup |
| Voice note | File upload, audio, 1 file | No | Added by hand, see Setup |

Respondents must sign in to a Google account to upload files. That is acceptable for the demo.

### Setup (`setup()`, run once from the bound Sheet)

Setup is idempotent: a second run creates no duplicate tabs, folders, form, or triggers.
1. Sets the spreadsheet time zone to America/New_York.
2. Creates the tabs `Job Log`, `Crew Hours`, `Flags`, `Dashboard`, and `Jobs` with the headers below, and adds the 3 sample jobs to `Jobs`.
3. Creates the Drive tree and writes each job folder id to `Jobs`.
4. Creates the Form, links its responses to this Sheet, and fills the Job dropdown.
5. Installs one spreadsheet `onFormSubmit` trigger that calls `onReportSubmit(e)`.
6. Adds a `Field-to-Office` menu with: Setup, Load sample reports.
7. Checks that Script Property `GEMINI_API_KEY` exists. If it doesn't, setup still finishes and shows an alert explaining how to add it.
8. Logs the Form edit URL and an instruction: add the file-upload questions `Photos` and `Voice note` by hand in the Form editor. `FormApp` cannot create file-upload items. This takes about 2 minutes.

### Processing (`onReportSubmit(e)`)

1. Takes a `LockService` script lock (30 s wait) so that simultaneous submissions don't collide.
2. Generates a Report ID in the form `R-<yyyyMMdd-HHmmss>-<4 random chars>`.
3. Appends the Job Log row **first**: inputs filled, `Status = Processing`. This makes sure no submission is lost.
4. Files the uploads: moves each one into `Daily Reports/<date>/` and renames it (see Drive). If a move fails, it keeps the original link and notes the failure in `Errors`.
5. Calls Gemini once with the report text plus inline images and audio (base64). If the attachments total more than 15 MB, it sends text only and notes `attachments skipped: size` in `Errors`.
6. On valid JSON:
   - fills in the Job Log row and sets `Status = Processed`
   - writes Crew Hours rows
   - writes Flags rows with `Status = Pending`
7. On any failure (HTTP error after 1 retry on 429/5xx, timeout, blocked response, invalid JSON, or schema mismatch):
   - sets `Status = Needs review`
   - puts the error message in `Errors`
   - puts the raw response body (truncated to 45,000 chars) in `Raw AI Output`
   - writes no Crew Hours or Flags rows
8. Never sends email or chat, and never acts on a flag.

### Gemini call

- `POST https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent`, where `GEMINI_MODEL` is an optional Script Property defaulting to `gemini-3.5-flash-lite` (ADR 0006).
- Example: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`
- Header `x-goog-api-key: <GEMINI_API_KEY from Script Properties>`. The key never appears in code, the Sheet, or logs.
- `generationConfig`: `responseMimeType: "application/json"`, `responseSchema` as below. No `temperature`: `gemini-3.5-flash-lite` ignores it (ADR 0006). The existing `0.2` is harmless; remove it the next time this code changes.
- The prompt tells Gemini to:
  - extract only what the report states
  - leave out anything it can't find
  - quote the foreman's own words for evidence
  - flag work that sounds outside the original scope as a possible change order

```json
{
  "type": "OBJECT",
  "properties": {
    "summary": { "type": "STRING" },
    "crew": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": {
      "name": { "type": "STRING" },
      "classification": { "type": "STRING" },
      "hours": { "type": "NUMBER" } },
      "required": ["name", "classification", "hours"] } },
    "total_hours": { "type": "NUMBER" },
    "work_completed": { "type": "ARRAY", "items": { "type": "STRING" } },
    "issues": { "type": "ARRAY", "items": { "type": "STRING" } },
    "possible_change_orders": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": {
      "description": { "type": "STRING" },
      "reason": { "type": "STRING" },
      "evidence_quote": { "type": "STRING" } },
      "required": ["description", "reason", "evidence_quote"] } },
    "material_shortages": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": {
      "item": { "type": "STRING" },
      "qty": { "type": "STRING", "nullable": true },
      "needed_by": { "type": "STRING", "nullable": true } },
      "required": ["item"] } },
    "confidence": { "type": "NUMBER" }
  },
  "required": ["summary", "crew", "total_hours", "work_completed", "issues",
               "possible_change_orders", "material_shortages", "confidence"]
}
```

`confidence` is a number from 0 to 1. `classification` uses IBEW-style titles such as Foreman, Journeyman Wireman, and Apprentice. `needed_by` is an ISO date if one is stated, otherwise free text such as "Thursday".

### Sheet tabs and columns (exact headers, in order)

Types and examples are in the [data dictionary](../../data-dictionary.md).

- **Job Log**: Report ID | Submitted At | Report Date | Job # | Job Name | PM | Foreman | Report Text | Summary | Total Hours | Crew Count | Work Completed | Issues | Flags Raised | Confidence | Photo Links | Voice Note Link | Report Folder | Status | Errors | Raw AI Output | Source
- **Crew Hours**: Report ID | Report Date | Job # | Foreman | Crew Member | Classification | Hours
- **Flags**: Flag ID | Report ID | Report Date | Job # | PM | Type | Description | Detail | Evidence Quote | Needed By | Status | PM Note | Reviewed By | Reviewed At
- **Jobs**: Job # | Job Name | PM | Drive Folder ID | Active
- **Dashboard**: formulas only, no script writes after setup

Field rules:
- `Status` (Job Log) is one of `Processing`, `Processed`, or `Needs review`.
- `Source` is `Form` or `Sample`.
- `Type` (Flags) is `Change order` or `Material shortage`.
- `Detail` is the change-order reason or the shortage quantity.
- `Status` (Flags) has data validation `Pending`, `Approved`, `Rejected`, and starts as `Pending`.
- `Reviewed By` and `Reviewed At` are typed by the PM. The script does not fill them.
- Multi-value cells (Work Completed, Issues, Photo Links) are newline-separated.

**Dashboard** sections, top to bottom, each with a label:
1. Today's reports: a FILTER of Job Log rows where Report Date = TODAY().
2. Hours by job: a QUERY summing Crew Hours.Hours by Job #.
3. Open flags: a COUNTIF on Flags.Status = "Pending", plus a FILTER list.
4. Pilot scorecard:
   - Reports processed (count of Job Log rows with Status = Processed)
   - Est. minutes saved, calculated as reports processed × the cell `Minutes saved per report` = 15, labelled "Assumption, not measured"
   - Flags raised
   - Flags approved

### Drive

- Path: `Field-to-Office Demo/Jobs/<Job #> - <Job Name>/{Daily Reports/<YYYY-MM-DD>/, Change Orders/, Photos/}`
- Setup creates every folder except the date folders. Date folders are created on demand.
- File name: `<YYYY-MM-DD>_<Job #>_<Foreman>_<n>.<ext>`.
  - `<Foreman>` keeps letters, digits, and hyphens. Spaces become `-`.
  - `n` starts at 1 per report and skips any name that already exists in the folder.
  - `ext` comes from the original name in lowercase, or from the MIME type if there isn't one.
  - Example: `2026-11-03_J-2401_Luis-Ramirez_1.jpg`.
- Job Log stores the file URLs and the date-folder URL.

### Sample data (`loadSampleReports()`)

Runs 3 fictional text-only reports, one per job, through the same pipeline, with `Source = Sample`. It skips any sample whose text already exists in Job Log, so rerunning it adds nothing. Together the samples must yield at least 1 possible change order and 1 material shortage.

### Edge cases

- No attachments: the report runs text only.
- A job in the Form that's missing from Jobs: the report is logged, with `Errors = unknown job` and files left in place.
- Gemini returns empty `crew`: no Crew Hours rows. `Crew Count` is 0.
- `total_hours` differs from the sum of crew hours: both are kept, and `Errors` notes the mismatch. The report still counts as Processed.
- The trigger runs near the 6-min limit: the Job Log row already exists and shows `Processing`. A row stuck in `Processing` means "check by hand".

## Acceptance tests

1. **Given** a new Google Sheet with the script pasted in, **when** `setup()` runs, **then** the 5 tabs exist with the exact headers, Jobs lists J-2401, J-2402, and J-2403, and a Form exists linked to the Sheet.
2. **Given** setup has run, **when** I open Drive, **then** each job has the folder `Field-to-Office Demo/Jobs/<Job # - Name>` with `Daily Reports`, `Change Orders`, and `Photos`, and its id is in Jobs.
3. **Given** setup has run once, **when** `setup()` runs again, **then** there are no duplicate tabs, folders, forms, or triggers (exactly 1 trigger in the project's Triggers page).
4. **Given** `GEMINI_API_KEY` is set, **when** a foreman submits text only for J-2402, **then** within 1 minute Job Log has 1 row with `Status = Processed`, a Summary, Total Hours, and Source = Form.
5. **Given** a submission naming 3 crew with hours, **when** it is processed, **then** Crew Hours has 3 rows with that Report ID, and their Hours sum matches what the report states.
6. **Given** a report saying "GC asked us to add 4 receptacles in Room 112, not on drawings", **when** it is processed, **then** Flags has a `Change order` row with Status `Pending`, a non-empty Evidence Quote, and a Status dropdown of Pending/Approved/Rejected.
7. **Given** a report saying "short 200 ft of 3/4 EMT, need by Thursday", **when** it is processed, **then** Flags has a `Material shortage` row with Detail containing "200" and Needed By filled.
8. **Given** a submission with 2 photos and a voice note on 2026-11-03, **when** it is processed, **then** the 3 files are in `Daily Reports/2026-11-03/`, they are named `2026-11-03_<Job #>_<Foreman>_1..3.<ext>`, and their links are in Photo Links, Voice Note Link, and Report Folder.
9. **Given** `GEMINI_API_KEY` is set to an invalid value, **when** a report is submitted, **then** Job Log still has the row with `Status = Needs review`, the HTTP error in Errors, and the original Report Text, and Crew Hours and Flags get no rows.
10. **Given** Gemini returns text that isn't valid JSON (simulated by a test hook or a bad schema), **when** it is processed, **then** the row is `Needs review`, Errors says "invalid JSON", and the raw text is in Raw AI Output.
11. **Given** a PM sets a flag to Approved and types a note, **when** 10 minutes pass and another report is submitted, **then** the flag row is unchanged, and no email, chat, or file was sent or created because of the approval.
12. **Given** setup and `loadSampleReports()` have run, **when** I open Dashboard, **then** it shows today's reports, hours by job for 3 jobs, an open-flag count ≥ 2 with a list, and a scorecard where Est. minutes saved = reports processed × 15, labelled as an assumption.
13. **Given** `loadSampleReports()` has run, **when** it runs again, **then** Job Log gains no new Sample rows.
14. **Given** the repo `tjonesy10/field-to-office` at any commit, **when** I search it with `git grep -nE "AIza[0-9A-Za-z_-]{20,}|GEMINI_API_KEY\s*[:=]\s*['\"][^'\"]+"`, **then** there are no matches. The key exists only in Script Properties.

## Non-goals

- Email, Gmail, Google Chat, or SMS intake
- A separate web-app dashboard or Looker Studio
- Any automatic action on flags: no change-order drafts, no emails to PMs, no purchase orders
- Auth and roles beyond Google sharing
- Retry or reprocess buttons for `Needs review` rows (a manual resubmit is fine for the demo)
- Production hardening, monitoring, multi-account deployment, and real company data

## Allowed dependencies

- Apps Script built-ins: `SpreadsheetApp`, `FormApp`, `DriveApp`, `UrlFetchApp`, `PropertiesService`, `Utilities`, plus `ScriptApp` (triggers), `LockService` (concurrency), and `Logger`/`console`
- Gemini REST API (`generativelanguage.googleapis.com`, default model `gemini-3.5-flash-lite`, overridable via Script Property `GEMINI_MODEL`)
- No npm libraries and no Apps Script libraries. `clasp` is optional, for pushing from the repo.

## Assumptions

1. **Run location:** Cosmo's own personal Google account (consumer, not Workspace). Cosmo pastes the script into a Sheet, runs Setup, creates the Gemini API key in that account, and enters it himself as Script Property `GEMINI_API_KEY`. The engineer never needs access to the account or the key. *Confirmed by Cosmo via Groko, 2026-11-03.*
2. **Consumer-account limits apply:**
   - no domain-wide features (no shared drives, no domain-restricted Forms, no admin console)
   - a 6-min execution limit per run
   - consumer daily quotas for UrlFetch and trigger runtime
   - Form file upload requires respondents to sign in with a Google account
   - Demo volume (tens of reports a day) is far below all of these.
3. **AI:** Gemini (`gemini-3.5-flash-lite` by default, per ADR 0006) through an AI Studio API key created under the same account. The key is stored as Script Property `GEMINI_API_KEY` and never committed. The AI Studio free tier may use inputs to improve Google's products, so only fictional data goes in.
4. **Repo:** GitHub `tjonesy10/field-to-office` is confirmed. Docs and code reach `main` by PR.
5. The file-upload questions are added by hand, because `FormApp` can't create them.
6. Report date can't default to today in Forms. Blank means the submission date.
7. All times are America/New_York.
8. The 15 minutes saved per report is an illustrative assumption, not a measurement.
9. **Unknown job** (a Job value not in the Jobs tab): Gemini still runs on the report text so nothing is lost. Confirmed 2026-11-03 after build.
10. **total_hours mismatch** (the total differs from the sum of crew hours): the row is still `Processed`. Confirmed 2026-11-03.
11. **confidence outside 0-1** counts as a schema mismatch, so the row is handled like invalid JSON (`Needs review`). Confirmed 2026-11-03.
12. **OAuth scope:** the script needs full Drive access (`https://www.googleapis.com/auth/drive`), because that's the only way to move Form uploads. This is acceptable on a personal demo account. In production, review the scope with IT. Confirmed 2026-11-03.

## Open questions

None blocking. Minor items are logged as assumptions 5–12 above.

## ADRs

- [0001 Google Form intake](../../adr/0001-google-form-intake.md)
- [0002 Apps Script in Workspace (build vs buy)](../../adr/0002-apps-script-in-workspace.md)
- [0003 Gemini multimodal extraction](../../adr/0003-gemini-multimodal-extraction.md)
- [0004 Human-in-the-loop flags](../../adr/0004-human-in-the-loop-flags.md)
- [0005 Sheets dashboard tab](../../adr/0005-sheets-dashboard-tab.md)
- [0006 Gemini model: gemini-3.5-flash-lite](../../adr/0006-gemini-model-3-5-flash-lite.md) (supersedes the model choice in 0003)
