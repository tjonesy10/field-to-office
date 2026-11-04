# F001 Handoff log

Append-only. Never edit earlier lines. Line format: `[timestamp] [bot] DONE -> [file] -> next: [bot] | Decided/Rejected: ...` or `[timestamp] [bot] BLOCKED -> reason`.

[2026-11-03 17:45 ET] [blueprint] DONE -> SPEC.md -> next: forge | Decided: Form intake, Apps Script bound to Sheet, Gemini 2.5 Flash, HITL flags, Sheet dashboard (ADR 0001-0005) | Rejected: hosted service, auto change orders, Looker Studio
[2026-11-03 17:56 ET] [blueprint] DONE -> SPEC.md (assumption 1: runs on Cosmo's personal Google account; he enters GEMINI_API_KEY) -> next: forge | Decided: no change to build; setup README addresses Cosmo as the operator
[2026-11-03 18:10 ET] [forge] DONE -> TEST_REPORT.md (https://github.com/tjonesy10/field-to-office/blob/cursor/f001-daily-field-report-5805/docs/features/F001-daily-field-report/TEST_REPORT.md), code PR https://github.com/tjonesy10/field-to-office/pull/2 -> next: Groko | Offline: node --test 38/38 pass; AT9 AT10 AT11 AT13 AT14 PASS; AT1-8 and AT12 UNKNOWN pending Cosmo's live run per SETUP.md | Decided: unknown job still runs Gemini on text; total_hours mismatch stays Processed; confidence outside 0-1 = schema mismatch; folder/form ids kept in script properties FTO_ROOT_FOLDER_ID/FTO_FORM_ID for idempotent setup; full drive scope needed to move Form uploads
[2026-11-03 18:12 ET] [blueprint] DONE -> SPEC.md (assumptions 9-12 confirm forge's 4 readings) -> next: Cosmo live run (AT1-8, AT12) | Decided: all 4 readings accepted as built
[2026-11-03 18:52 ET] [blueprint] DONE -> SPEC.md + ADR 0006 (model gemini-3.5-flash-lite, optional GEMINI_MODEL override) -> next: forge | Rejected: keep 2.5-flash (404), hard-coded id
