# Changelog

## 2026-11-03
- Added initial draft of F001 Daily Field Report docs: SPEC, HANDOFF, PRD, architecture, data dictionary, process maps, AI use policy and scorecard.
- Added ADRs 0001-0005 (Form intake, Apps Script, Gemini extraction, human-in-the-loop flags, Sheets dashboard).
- Resolved the open questions: dedicated personal Gmail bot account (assumption, to be confirmed by Groko), Gemini 2.5 Flash with the key in Script Properties `GEMINI_API_KEY`, and repo `tjonesy10/field-to-office`. Set ADRs 0001-0005 to Accepted.
- F001 handed off: blueprint DONE -> SPEC.md -> next: forge.
- Run location changed: the bot Gmail account was not created. The demo now runs on Cosmo's personal Google account, and he holds the Gemini key and enters it as Script Property `GEMINI_API_KEY`. Updated SPEC assumption 1 and architecture.md, and corrected the account wording in the context sections of ADRs 0001 and 0002. The decisions themselves are unchanged.
