# Data dictionary: Field-to-Office

All values are fictional. Times are America/New_York. Headers are exact and in order. The source of truth for behavior is the [SPEC](features/F001-daily-field-report/SPEC.md).

Sources: **Form** (the foreman's answer), **Script** (computed by Apps Script), **Gemini** (the AI output field), **Config** (the Jobs tab), **PM** (typed by hand), **Setup** (written once by `setup()`).

## Job Log (one row per report)

| Column | Type | Source | Example |
|---|---|---|---|
| Report ID | Text | Script | R-20261103-163512-K7QF |
| Submitted At | Datetime | Form timestamp | 2026-11-03 16:35:12 |
| Report Date | Date | Form (blank = submit date) | 2026-11-03 |
| Job # | Text | Form (parsed from dropdown) | J-2401 |
| Job Name | Text | Config | Riverside Medical Office Bldg - Tenant Fit-Out |
| PM | Text | Config | Dana Ortiz |
| Foreman | Text | Form | Luis Ramirez |
| Report Text | Text | Form | Pulled MC for rooms 110-114... |
| Summary | Text | Gemini `summary` | 4-person crew roughed in rooms 110-114; GC added 4 receptacles in 112. |
| Total Hours | Number | Gemini `total_hours` | 32 |
| Crew Count | Integer | Script (len of crew) | 4 |
| Work Completed | Text, newline-separated | Gemini `work_completed` | Pulled MC rooms 110-114 |
| Issues | Text, newline-separated | Gemini `issues` | Ceiling grid in 113 blocks access |
| Flags Raised | Integer | Script | 2 |
| Confidence | Number 0-1 | Gemini `confidence` | 0.86 |
| Photo Links | URLs, newline-separated | Script | https://drive.google.com/file/d/... |
| Voice Note Link | URL | Script | https://drive.google.com/file/d/... |
| Report Folder | URL | Script | https://drive.google.com/drive/folders/... |
| Status | Enum: Processing, Processed, Needs review | Script | Processed |
| Errors | Text | Script | Gemini HTTP 400: API key not valid |
| Raw AI Output | Text (≤ 45,000 chars) | Script | {"summary": ... |
| Source | Enum: Form, Sample | Script | Form |

## Crew Hours (one row per crew member per report)

| Column | Type | Source | Example |
|---|---|---|---|
| Report ID | Text | Script | R-20261103-163512-K7QF |
| Report Date | Date | Job Log | 2026-11-03 |
| Job # | Text | Job Log | J-2401 |
| Foreman | Text | Job Log | Luis Ramirez |
| Crew Member | Text | Gemini `crew[].name` | Aisha Grant |
| Classification | Text | Gemini `crew[].classification` | Journeyman Wireman |
| Hours | Number | Gemini `crew[].hours` | 8 |

## Flags (one row per possible change order or material shortage)

| Column | Type | Source | Example |
|---|---|---|---|
| Flag ID | Text | Script (Report ID + -F<n>) | R-20261103-163512-K7QF-F1 |
| Report ID | Text | Script | R-20261103-163512-K7QF |
| Report Date | Date | Job Log | 2026-11-03 |
| Job # | Text | Job Log | J-2401 |
| PM | Text | Config | Dana Ortiz |
| Type | Enum: Change order, Material shortage | Script | Change order |
| Description | Text | Gemini `description` / `item` | Add 4 duplex receptacles, Room 112 |
| Detail | Text | Gemini `reason` (CO) / `qty` (shortage) | Not on drawings; GC super requested |
| Evidence Quote | Text | Gemini `evidence_quote` (CO only) | "GC asked us to add 4 receptacles in 112, not on drawings" |
| Needed By | Text | Gemini `needed_by` (shortage only) | 2026-11-05 |
| Status | Dropdown: Pending, Approved, Rejected | Script sets Pending; PM edits | Pending |
| PM Note | Text | PM | Confirm with GC; price as T&M |
| Reviewed By | Text | PM | Dana Ortiz |
| Reviewed At | Datetime | PM | 2026-11-03 17:10 |

## Jobs (config)

| Column | Type | Source | Example |
|---|---|---|---|
| Job # | Text | Setup | J-2401 |
| Job Name | Text | Setup | Riverside Medical Office Bldg - Tenant Fit-Out |
| PM | Text | Setup | Dana Ortiz |
| Drive Folder ID | Text | Setup | 1AbC...xyz |
| Active | Checkbox | Setup | TRUE |

Sample jobs:
- J-2401 Riverside Medical Office Bldg - Tenant Fit-Out (PM Dana Ortiz)
- J-2402 Harbor Logistics Warehouse - Service Upgrade 2000A (PM Marcus Lee)
- J-2403 Northgate Elementary - Fire Alarm Replacement (PM Priya Shah)

Sample foremen: Luis Ramirez (J-2401), Kevin O'Brien (J-2402), Tom Kowalski (J-2403).

## Dashboard (formulas only)

| Section | Formula basis | Example value |
|---|---|---|
| Today's reports | FILTER Job Log where Report Date = TODAY() | 3 rows |
| Hours by job | QUERY Crew Hours, sum Hours by Job # | J-2402: 40 |
| Open flags | COUNTIF Flags Status = "Pending", plus FILTER list | 2 |
| Reports processed | COUNTIF Job Log Status = "Processed" | 4 |
| Minutes saved per report | Input cell, labelled "Assumption, not measured" | 15 |
| Est. minutes saved | Reports processed × minutes per report | 60 |
| Flags raised | COUNTA Flags Flag ID | 3 |
| Flags approved | COUNTIF Flags Status = "Approved" | 1 |

## Gemini JSON fields

| Field | Type | Required | Notes |
|---|---|---|---|
| summary | string | yes | 1-3 sentences |
| crew[] | array of objects | yes (may be empty) | |
| crew[].name | string | yes | Aisha Grant |
| crew[].classification | string | yes | Foreman, Journeyman Wireman, Apprentice |
| crew[].hours | number | yes | 8 |
| total_hours | number | yes | 32 |
| work_completed[] | array of string | yes | |
| issues[] | array of string | yes | |
| possible_change_orders[] | array of objects | yes (may be empty) | |
| .description | string | yes | Add 4 receptacles, Room 112 |
| .reason | string | yes | Not on drawings |
| .evidence_quote | string | yes | The foreman's exact words |
| material_shortages[] | array of objects | yes (may be empty) | |
| .item | string | yes | 3/4" EMT |
| .qty | string, nullable | no | 200 ft |
| .needed_by | string, nullable | no | 2026-11-05 or "Thursday" |
| confidence | number 0-1 | yes | 0.86 |

## Drive conventions

- **Root:** `Field-to-Office Demo/Jobs/`
- **Job folder:** `<Job #> - <Job Name>/`, for example `J-2402 - Harbor Logistics Warehouse - Service Upgrade 2000A/`
- **Subfolders:** `Daily Reports/<YYYY-MM-DD>/` (created on demand), `Change Orders/`, `Photos/`
- **File name:** `<YYYY-MM-DD>_<Job #>_<Foreman>_<n>.<ext>`
  - The foreman name keeps letters, digits, and hyphens. Spaces become `-`.
  - `n` starts at 1 per report and skips names already in the folder.
  - Example: `2026-11-03_J-2402_Kevin-OBrien_2.m4a`
