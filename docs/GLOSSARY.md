# Glossary: Field-to-Office

Domain terms used in the specs, ADRs and code. Specs use these words exactly. When a SPEC or ADR introduces a term, add it here in the same PR. Code and data names refer to the [data dictionary](data-dictionary.md).

| Term | Definition | Code / data name |
|---|---|---|
| Daily report | One foreman's end-of-day account of a job, submitted through the Google Form. Also called a report. | Job Log row; `Source` = `Form` |
| Sample report | A fictional daily report seeded by the script for the demo. | `loadSampleReports()`; `Source` = `Sample` |
| Report ID | The unique id of a daily report. | `Report ID`, e.g. `R-20261103-163512-K7QF` |
| Report date | The workday a report covers. A blank date means the submission date (New York time). | `Report Date` |
| Report status | Where a report stands in processing: Processing, Processed or Needs review. | Job Log `Status` |
| Needs review | A report status meaning the AI call failed or its output didn't match the schema, so a person must read the raw report. | Job Log `Status` = `Needs review`; reason in `Errors` |
| Job | A construction project the company is working on. | Jobs tab row |
| Job # | The job's id. | `Job #`, e.g. `J-2401` |
| Foreman | The field lead who runs the crew and submits the daily report. | `Foreman` |
| PM | Project manager. Owns a job in the office and reviews its flags. | `PM` |
| Crew member | A worker on the foreman's crew for that day. | Crew Hours row; Gemini `crew[]` |
| Classification | A crew member's trade grade, such as Foreman, Journeyman Wireman or Apprentice. | `Classification`; Gemini `crew[].classification` |
| Crew hours | Hours each crew member worked on a report's date. | Crew Hours tab; Gemini `crew[].hours`, `total_hours` |
| Extraction | Gemini turning a report's text, photos and voice note into structured fields. | `generateContent` call; Gemini JSON fields |
| Confidence | The model's 0 to 1 self-rating of its extraction. It is shown, not used to gate anything. | `Confidence`; Gemini `confidence` |
| Flag | An item the AI thinks an office person should act on. It is either a possible change order or a material shortage, and it stays Pending until a PM decides. | Flags tab row; `Flag ID` = Report ID + `-F<n>` |
| Change order | Work outside the contract scope that may be billable. The AI only raises a possible change order; a PM decides. | Flag `Type` = `Change order`; Gemini `possible_change_orders[]` |
| Evidence quote | The foreman's exact words that led the AI to raise a possible change order. | `Evidence Quote`; Gemini `evidence_quote` |
| Material shortage | Material the crew needs and doesn't have. | Flag `Type` = `Material shortage`; Gemini `material_shortages[]` |
| Flag status | A PM's decision on a flag: Pending, Approved or Rejected. | Flags `Status` |
| Human in the loop | The rule that the AI never approves or acts on a flag; a PM does (ADR 0004). | Flags `Status`, `Reviewed By`, `Reviewed At` |
| Report folder | The Drive folder holding a report's photos and voice note. | `Jobs/<Job #> - <Job Name>/Daily Reports/<date>/`; `Report Folder` |
| Dashboard | The formula-only Sheet tab showing today's reports, hours, open flags and the scorecard numbers. | Dashboard tab |
| Minutes saved per report | An illustrative assumption (15) used to estimate time saved. It is not measured. | Dashboard input cell |
| Script Property | A setting stored in the Apps Script project, outside the repo. Secrets live only here. | `GEMINI_API_KEY`, `GEMINI_MODEL`, `FTO_ROOT_FOLDER_ID`, `FTO_FORM_ID` |
