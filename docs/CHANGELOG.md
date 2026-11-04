# Changelog

## 2026-11-04
- Added `docs/GLOSSARY.md`, the project's domain terms with their code and data names. Specs use its wording.
- Dropped `temperature: 0.2` from the SPEC's Gemini request; `gemini-3.5-flash-lite` ignores it (ADR 0006 consequences updated). No behavior change.

## 2026-11-03
- Added initial draft of F001 Daily Field Report docs: SPEC, HANDOFF, PRD, architecture, data dictionary, process maps, AI use policy and scorecard.
- Added ADRs 0001-0005 (Form intake, Apps Script, Gemini extraction, human-in-the-loop flags, Sheets dashboard).
- Resolved the open questions: dedicated personal Gmail bot account (assumption, to be confirmed by Groko), Gemini 2.5 Flash with the key in Script Properties `GEMINI_API_KEY`, and repo `tjonesy10/field-to-office`. Set ADRs 0001-0005 to Accepted.
- F001 handed off: blueprint DONE -> SPEC.md -> next: forge.
- Run location changed: the bot Gmail account was not created. The demo now runs on Cosmo's personal Google account, and he holds the Gemini key and enters it as Script Property `GEMINI_API_KEY`. Updated SPEC assumption 1 and architecture.md, and corrected the account wording in the context sections of ADRs 0001 and 0002. The decisions themselves are unchanged.
- 2026-11-03: Confirmed forge's four build-time readings as SPEC assumptions 9-12 (unknown job, total_hours mismatch, confidence range, full Drive scope). No behavior change.
- 2026-11-03: Changed the model from `gemini-2.5-flash` (404 for new API users) to `gemini-3.5-flash-lite`, configurable via Script Property `GEMINI_MODEL` (ADR 0006, superseding the model choice in 0003). Updated SPEC, architecture.md, and the AI policy.
