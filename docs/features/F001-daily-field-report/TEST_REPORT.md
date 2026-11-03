# F001 test report

Offline run on this branch. No Google account and no live Gemini call were used. A passing offline test is not a live PASS when the acceptance test needs real Google behavior. Those rows stay UNKNOWN until the manual step below is done.

Command:

```bash
node --test
```

Exit code: 0. 38 tests, 38 passed, 0 failed.

## AT1–AT14

| AT | Status | Evidence | What is still unproven, and the manual step |
|---|---|---|---|
| AT1 | UNKNOWN | Partial: `AT1 setup creates the five tabs, exact headers, three jobs, and a form linked to the sheet` passed. The fake spreadsheet has the five tabs and exact headers, Jobs lists J-2401, J-2402, and J-2403, and `setDestination` is called once with this spreadsheet id. | Real Form linking. After Setup, confirm the five tabs and headers, the three jobs, and that the Form's response destination is this Sheet. |
| AT2 | UNKNOWN | Partial: `AT2 each job folder has Daily Reports, Change Orders, and Photos, and the id is on Jobs` passed against a fake Drive. | Real Drive. Open `Field-to-Office Demo/Jobs/<Job # - Name>/` and confirm `Daily Reports`, `Change Orders`, and `Photos`. The folder id in the URL matches Jobs → Drive Folder ID. Date folders are not created by Setup. |
| AT3 | UNKNOWN | Partial: `AT3 a second setup does not duplicate tabs, folders, the form, or the trigger` passed. The fake ends with one form, one `onReportSubmit` trigger, one demo folder, one of each tab, and four form questions. | The Triggers page is real Google UI. Run Setup again. Confirm no second tab, folder, or form. Extensions → Apps Script → Triggers shows exactly one trigger, function `onReportSubmit`, event On form submit. |
| AT4 | UNKNOWN | Partial: `AT4 a text-only submission is logged first, then processed from one Gemini call` passed. Before the stubbed response returns, the row is `Processing` with the report text and Source `Form`. After a valid JSON body it is `Processed` with Summary and Total Hours. One POST to the Gemini 2.5 Flash URL, header `x-goog-api-key`, temperature 0.2. | Real Gemini output and the 1-minute bound. Submit text only for J-2402 and time it. Within 1 minute, Job Log has one new row, Status `Processed`, a Summary, Total Hours, Source `Form`. |
| AT5 | UNKNOWN | Partial: `AT5 three crew members become three Crew Hours rows whose hours sum to the report` passed. Three rows share the Report ID and their Hours sum to Total Hours from the stubbed JSON. | Real Gemini quality. Submit a report that names 3 crew and their hours. Crew Hours has 3 rows for that Report ID, and the Hours sum equals what the report text says. |
| AT6 | UNKNOWN | Partial: `AT6 a change order is a Pending flag and the Status column has the review dropdown` passed. The stubbed change order is written as Type `Change order`, Status `Pending`, with the evidence quote, and the Flags Status range has a list validation of Pending, Approved, Rejected. | Real Gemini wording and the dropdown rendering in Sheets. Submit a report that says `GC asked us to add 4 receptacles in Room 112, not on drawings`. Flags has a Change order row, Status Pending, Evidence Quote not empty, and the Status cell offers Pending / Approved / Rejected. |
| AT7 | UNKNOWN | Partial: `AT7 a material shortage keeps quantity in Detail and fills Needed By` passed for stubbed JSON (`Detail` `200 ft`, Needed By `Thursday`). | Real Gemini quality. Submit a report that says `short 200 ft of 3/4 EMT, need by Thursday`. Flags has a Material shortage row, Detail contains `200`, Needed By is filled. |
| AT8 | UNKNOWN | Partial: `AT8 photos and a voice note are renamed into the date folder and linked` passed in the fake. Two images and one audio file land in `Daily Reports/2026-11-03/` as `2026-11-03_J-2401_Luis-Ramirez_1.jpg`, `_2.png`, and `_3.m4a`, and the three link columns match. | Real Drive moves of Form uploads. Submit 2 photos and a voice note and confirm the folder, the names, and Photo Links, Voice Note Link, and Report Folder. |
| AT9 | PASS | `AT9 an HTTP 400 or 401 keeps the row, the report text, and writes no crew or flags`. For both codes the row is appended as `Processing` first, then `Needs review`, Errors is `Gemini HTTP 400: API key not valid` or the 401 equivalent, Report Text is unchanged, Raw AI Output holds the body, and Crew Hours and Flags gain no rows. Neither code is retried. | None for this criterion. The HTTP body is stubbed. A live check with a bad property value is in the checklist if you want to see Google's own error text. |
| AT10 | PASS | `AT10 invalid JSON is Needs review, says invalid JSON, and keeps the raw text`. Errors is exactly `invalid JSON`. Raw AI Output is `this is not json`. No Crew Hours or Flags rows. | None. The spec allows this to be simulated. |
| AT11 | PASS | `AT11 an approved flag is unchanged by a later submission, and approval sends nothing`. After Status, PM Note, Reviewed By, and Reviewed At are edited, a second `onReportSubmit` leaves that row identical. No new Drive file is created. `App.js` and `Logic.js` contain no MailApp, GmailApp, sendEmail, timeBased, or everyMinutes. The only trigger type created is `ON_FORM_SUBMIT`. Dashboard cells are unchanged. | The test does not wait 10 wall-clock minutes. There is no timer to fire. The checklist still has you wait 10 minutes on the live Sheet so you can see it. |
| AT12 | UNKNOWN | Partial: `AT12 dashboard formulas cover today, hours, open flags, and the 15-minute assumption` passed. Setup writes the formulas and does not rewrite them on a later submission. Est. minutes saved is `=B161*B162`, and B162 is the number 15 next to `Assumption, not measured`. | Formulas rendering in Sheets. After samples, open Dashboard and confirm today's reports, hours for the jobs that have crew rows, an open-flag count of at least 2 with a list, and Est. minutes saved = reports processed × 15, with the assumption label. |
| AT13 | PASS | `AT13 loadSampleReports adds three sample rows once and skips them on the second run`. First run: 3 rows, Source `Sample`, jobs J-2401, J-2402, J-2403. Second run: still 3 rows, and UrlFetch is not called again. | None for the "no new rows" criterion. Whether live Gemini turns the sample text into a change order and a shortage is UNKNOWN; see the checklist. |
| AT14 | PASS | `AT14 the repo contains no Gemini API key`, and the grep below. Exit code 1, no output. | None. |

## Grep (AT14)

Command:

```bash
git grep -nE "AIza[0-9A-Za-z_-]{20,}|GEMINI_API_KEY\s*[:=]\s*['\"][^'\"]+"
```

Result: no output. Exit code 1 (git grep's code for no matches).

## Full `node --test` output

Captured on this branch before this report file existed. Exit code 0. A second `node --test` after this file was added also exited 0 (38 passed, about 144 ms). `git grep` on the tree that includes this file exited 1 with no output.

```
TAP version 13
# Subtest: App.js parses as JavaScript
ok 1 - App.js parses as JavaScript
  ---
  duration_ms: 25.811074
  type: 'test'
  ...
# Subtest: appsscript.json sets America/New_York, V8, and the scopes this script calls
ok 2 - appsscript.json sets America/New_York, V8, and the scopes this script calls
  ---
  duration_ms: 0.22883
  type: 'test'
  ...
# Subtest: AT1 setup creates the five tabs, exact headers, three jobs, and a form linked to the sheet
ok 3 - AT1 setup creates the five tabs, exact headers, three jobs, and a form linked to the sheet
  ---
  duration_ms: 3.909281
  type: 'test'
  ...
# Subtest: AT2 each job folder has Daily Reports, Change Orders, and Photos, and the id is on Jobs
ok 4 - AT2 each job folder has Daily Reports, Change Orders, and Photos, and the id is on Jobs
  ---
  duration_ms: 2.316712
  type: 'test'
  ...
# Subtest: AT3 a second setup does not duplicate tabs, folders, the form, or the trigger
ok 5 - AT3 a second setup does not duplicate tabs, folders, the form, or the trigger
  ---
  duration_ms: 1.024424
  type: 'test'
  ...
# Subtest: AT4 a text-only submission is logged first, then processed from one Gemini call
ok 6 - AT4 a text-only submission is logged first, then processed from one Gemini call
  ---
  duration_ms: 13.156223
  type: 'test'
  ...
# Subtest: AT5 three crew members become three Crew Hours rows whose hours sum to the report
ok 7 - AT5 three crew members become three Crew Hours rows whose hours sum to the report
  ---
  duration_ms: 2.12536
  type: 'test'
  ...
# Subtest: AT6 a change order is a Pending flag and the Status column has the review dropdown
ok 8 - AT6 a change order is a Pending flag and the Status column has the review dropdown
  ---
  duration_ms: 1.661524
  type: 'test'
  ...
# Subtest: AT7 a material shortage keeps quantity in Detail and fills Needed By
ok 9 - AT7 a material shortage keeps quantity in Detail and fills Needed By
  ---
  duration_ms: 1.641107
  type: 'test'
  ...
# Subtest: AT8 photos and a voice note are renamed into the date folder and linked
ok 10 - AT8 photos and a voice note are renamed into the date folder and linked
  ---
  duration_ms: 3.231353
  type: 'test'
  ...
# Subtest: AT9 an HTTP 400 or 401 keeps the row, the report text, and writes no crew or flags
ok 11 - AT9 an HTTP 400 or 401 keeps the row, the report text, and writes no crew or flags
  ---
  duration_ms: 3.785765
  type: 'test'
  ...
# Subtest: AT10 invalid JSON is Needs review, says invalid JSON, and keeps the raw text
ok 12 - AT10 invalid JSON is Needs review, says invalid JSON, and keeps the raw text
  ---
  duration_ms: 1.620416
  type: 'test'
  ...
# Subtest: AT11 an approved flag is unchanged by a later submission, and approval sends nothing
ok 13 - AT11 an approved flag is unchanged by a later submission, and approval sends nothing
  ---
  duration_ms: 3.329501
  type: 'test'
  ...
# Subtest: AT12 dashboard formulas cover today, hours, open flags, and the 15-minute assumption
ok 14 - AT12 dashboard formulas cover today, hours, open flags, and the 15-minute assumption
  ---
  duration_ms: 0.974881
  type: 'test'
  ...
# Subtest: AT13 loadSampleReports adds three sample rows once and skips them on the second run
ok 15 - AT13 loadSampleReports adds three sample rows once and skips them on the second run
  ---
  duration_ms: 3.849796
  type: 'test'
  ...
# Subtest: AT14 the repo contains no Gemini API key
ok 16 - AT14 the repo contains no Gemini API key
  ---
  duration_ms: 2.732224
  type: 'test'
  ...
# Subtest: schema mismatch and a blocked response write no crew or flag rows
ok 17 - schema mismatch and a blocked response write no crew or flag rows
  ---
  duration_ms: 3.237226
  type: 'test'
  ...
# Subtest: 429 is retried once and then succeeds; a second 429 becomes Needs review
ok 18 - 429 is retried once and then succeeds; a second 429 becomes Needs review
  ---
  duration_ms: 4.017225
  type: 'test'
  ...
# Subtest: attachments over 15 MB are filed and the Gemini call is text only
ok 19 - attachments over 15 MB are filed and the Gemini call is text only
  ---
  duration_ms: 1.630032
  type: 'test'
  ...
# Subtest: an unknown job is logged, leaves the file in place, and still records unknown job
ok 20 - an unknown job is logged, leaves the file in place, and still records unknown job
  ---
  duration_ms: 1.403456
  type: 'test'
  ...
# Subtest: empty crew writes no Crew Hours rows and a total_hours mismatch stays Processed
ok 21 - empty crew writes no Crew Hours rows and a total_hours mismatch stays Processed
  ---
  duration_ms: 2.836047
  type: 'test'
  ...
# Subtest: a file name already in the date folder takes the next index, and a failed move keeps the original link
ok 22 - a file name already in the date folder takes the next index, and a failed move keeps the original link
  ---
  duration_ms: 3.831479
  type: 'test'
  ...
# Subtest: a blank report date uses the submission date in America/New_York
ok 23 - a blank report date uses the submission date in America/New_York
  ---
  duration_ms: 1.472402
  type: 'test'
  ...
# Subtest: setup finishes without a key, and a missing key does not drop the submission
ok 24 - setup finishes without a key, and a missing key does not drop the submission
  ---
  duration_ms: 1.294645
  type: 'test'
  ...
# Subtest: a thrown fetch and a lock timeout still leave a Job Log row
ok 25 - a thrown fetch and a lock timeout still leave a Job Log row
  ---
  duration_ms: 2.879285
  type: 'test'
  ...
# Subtest: Logic.js parses as JavaScript
ok 26 - Logic.js parses as JavaScript
  ---
  duration_ms: 21.681484
  type: 'test'
  ...
# Subtest: report id uses America/New_York and a 4-character suffix
ok 27 - report id uses America/New_York and a 4-character suffix
  ---
  duration_ms: 12.320293
  type: 'test'
  ...
# Subtest: blank report date is the submission date in America/New_York, including across midnight
ok 28 - blank report date is the submission date in America/New_York, including across midnight
  ---
  duration_ms: 1.360508
  type: 'test'
  ...
# Subtest: foreman slug keeps letters, digits, and hyphens
ok 29 - foreman slug keeps letters, digits, and hyphens
  ---
  duration_ms: 1.216043
  type: 'test'
  ...
# Subtest: file names use the report date, job, foreman, and a skipped index
ok 30 - file names use the report date, job, foreman, and a skipped index
  ---
  duration_ms: 1.21354
  type: 'test'
  ...
# Subtest: job choice parsing and file urls
ok 31 - job choice parsing and file urls
  ---
  duration_ms: 0.814793
  type: 'test'
  ...
# Subtest: schema accepts an empty crew and nullable shortage fields, and rejects a mismatch of types
ok 32 - schema accepts an empty crew and nullable shortage fields, and rejects a mismatch of types
  ---
  duration_ms: 0.915457
  type: 'test'
  ...
# Subtest: gemini body parser distinguishes invalid JSON, schema mismatch, and a blocked response
ok 33 - gemini body parser distinguishes invalid JSON, schema mismatch, and a blocked response
  ---
  duration_ms: 1.629974
  type: 'test'
  ...
# Subtest: crew and flag rows keep the report id and do not invent review fields
ok 34 - crew and flag rows keep the report id and do not invent review fields
  ---
  duration_ms: 1.38385
  type: 'test'
  ...
# Subtest: samples cover three jobs and include one change-order phrase and one shortage phrase
ok 35 - samples cover three jobs and include one change-order phrase and one shortage phrase
  ---
  duration_ms: 1.03662
  type: 'test'
  ...
# Subtest: gemini request uses the schema, temperature 0.2, and no API key
ok 36 - gemini request uses the schema, temperature 0.2, and no API key
  ---
  duration_ms: 0.79092
  type: 'test'
  ...
# Subtest: dashboard formulas are labels plus FILTER, QUERY, and COUNTIF only
ok 37 - dashboard formulas are labels plus FILTER, QUERY, and COUNTIF only
  ---
  duration_ms: 0.80125
  type: 'test'
  ...
# Subtest: initial job log row is Processing and keeps the report text
ok 38 - initial job log row is Processing and keeps the report text
  ---
  duration_ms: 0.809188
  type: 'test'
  ...
1..38
# tests 38
# suites 0
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 145.942077
```

## Other offline cases (not separate acceptance tests)

All passed in the same `node --test` run:

- Schema mismatch and a blocked Gemini response → `Needs review`, no crew or flag rows.
- HTTP 429 then 200 → two calls, `Processed`. HTTP 429 then 503 → two calls, `Needs review`, no crew rows.
- Attachment larger than 15 MB → file is renamed into the date folder, Gemini is text only, Errors contains `attachments skipped: size`, and the file bytes are not read.
- Unknown job → row logged, Errors is `unknown job`, file is not moved, original link kept. See interpretations.
- Empty crew → Crew Count 0, no Crew Hours rows, `Processed`.
- `total_hours` different from the crew sum → both kept, `Processed`, Errors notes the mismatch.
- A taken file name skips to the next index. A failed move keeps the original link.
- Blank report date at 2026-11-04 03:30 UTC is 2026-11-03 in America/New_York. Report id prefix `R-20261103-223000-`.
- Setup with no key still creates the sheet, form, and alert. The submission is logged as `Needs review` and Gemini is not called.
- A thrown fetch, and a lock wait that throws, still leave a Job Log row.

## Interpretations

These are not extra features. They are the readings used where the spec states the outcome but not every branch.

- Unknown job: the row is logged, files stay where the Form put them, original links are stored, and Errors is `unknown job` when nothing else failed. Gemini still runs on the text. Status follows that result (`Processed` or `Needs review`). The spec does not say to skip the model call.
- Hours mismatch note text: `total_hours mismatch: total_hours X != sum of crew hours Y`.
- `confidence` outside 0 through 1 is a schema mismatch.
- Dashboard sections sit at rows 1, 104, 120, and 160 so a spilled FILTER or QUERY does not cover the next section. An empty FILTER or QUERY shows `None` via IFERROR. Est. minutes saved references the 15 cell rather than hard-coding 15 in the formula.
- Report Date is stored as a date at America/New_York midnight so it can equal `TODAY()` on the Dashboard.
- If the 30-second script lock cannot be acquired, the submission is still logged.
- The demo folder id and the Form id are stored in script properties `FTO_ROOT_FOLDER_ID` and `FTO_FORM_ID` so a second Setup reuses them.
- A report date in `yyyy-MM-dd` or `M/d/yyyy` is accepted. Blank, or a value that is not a date, uses the submission date in America/New_York.
- A file move that throws keeps the original link and adds `file move failed:` to Errors. The Gemini call still runs.

No spec question blocked the build.

## Manual checklist to close the UNKNOWNs

Do this on your personal Google account after [SETUP.md](../../../SETUP.md). Use fictional text only. Do not paste the API key into chat.

1. **AT1.** After Setup, check the tabs Job Log, Crew Hours, Flags, Dashboard, and Jobs, and that row 1 matches the spec headers. Jobs lists J-2401, J-2402, and J-2403 with the three PMs. Open the Form and confirm its response destination is this Sheet. PASS or FAIL.
2. **AT2.** In Drive, open `Field-to-Office Demo/Jobs/`. Each job folder is named `<Job #> - <Job Name>` and contains `Daily Reports`, `Change Orders`, and `Photos`. The id in the folder URL equals Drive Folder ID on that Jobs row. PASS or FAIL.
3. **AT3.** Run Setup again. Confirm the same five tabs (no copies), one `Field-to-Office Demo` folder, and one Form. Extensions → Apps Script → Triggers shows exactly one trigger: `onReportSubmit`, On form submit. PASS or FAIL.
4. **AT4.** Submit the Form for J-2402 with text only. Within 1 minute, Job Log has a new row, Status `Processed`, Summary filled, Total Hours filled, Source `Form`. PASS or FAIL.
5. **AT5.** Submit a report that names three people and their hours. Crew Hours has three rows with that Report ID, and the Hours sum equals the hours in the text. PASS or FAIL.
6. **AT6.** Submit a report containing `GC asked us to add 4 receptacles in Room 112, not on drawings`. Flags has a `Change order` row, Status `Pending`, Evidence Quote not empty. Click Status and confirm the dropdown is Pending, Approved, Rejected. PASS or FAIL.
7. **AT7.** Submit a report containing `short 200 ft of 3/4 EMT, need by Thursday`. Flags has a `Material shortage` row, Detail contains `200`, Needed By is filled. PASS or FAIL.
8. **AT8.** Submit J-2401 as Luis Ramirez with Report date 2026-11-03 (or leave the date blank and use today's date in the expected file name), 2 photos, and 1 voice note. The three files are in `Daily Reports/<that date>/`, named `<date>_J-2401_Luis-Ramirez_1`, `_2`, and `_3` with their extensions. Photo Links, Voice Note Link, and Report Folder on that row point at those files and that folder. PASS or FAIL.
9. **AT9 (optional live check; offline status is already PASS).** Put a wrong value in the script property, submit a fictional one-line report, and confirm the new Job Log row is `Needs review`, Errors contains the HTTP error, Report Text is what you typed, and that Report ID has no Crew Hours or Flags rows. Put the real key back. Do not copy the key into chat.
10. **AT11 (optional live check; offline status is already PASS).** Set one flag to Approved and type a PM note, Reviewed By, and Reviewed At. Wait 10 minutes. Submit another fictional report. That flag row is unchanged. No email arrived, and no file was created because of the approval.
11. **AT12.** Open Dashboard. Confirm today's reports, hours by job, an open-flag count of at least 2 plus a list, and Est. minutes saved = reports processed × 15, with `Assumption, not measured` next to the 15. If a formula cell shows a parse error, the spreadsheet locale likely wants semicolons instead of commas. PASS or FAIL.
12. **Samples.** After Load sample reports, Job Log has three Source `Sample` rows. Run Load sample reports again and confirm the Sample count does not change (AT13, already PASS offline). Also note whether Flags contains at least one Change order and one Material shortage from those samples. That yield is live Gemini quality and is not yet PASS or FAIL.
13. **AT10 and AT14** need no live step. AT10 was simulated. AT14 is the grep above.

A row left on `Processing` means the run stopped early. The 6-minute limit is the usual reason. Check that row by hand. There is no retry button.
