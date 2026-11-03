# AI use policy and pilot scorecard (draft for the Field-to-Office pilot)

**Purpose:** Let teams use AI to cut admin time while keeping company, employee, and customer data safe and keeping people accountable for decisions.

**Approved tools (pilot)**
- Gemini, through Google Workspace or the Gemini API (Gemini 2.5 Flash for Field-to-Office).
- Any other AI tool goes through the approval path below first.
- The pilot uses fictional data only, because AI Studio free-tier terms may let Google use inputs.

**Data that MAY go into AI**
- Job field notes: work done, crew names, classifications, and hours.
- Site photos, without people's faces where possible.
- Fictional or approved pilot data.

**Data that MAY NOT go into AI**
- SSNs and other government IDs.
- Payroll rates and wage data.
- Personal health or injury details. Write "incident occurred" only.
- Customer contract pricing and bids.
- Passwords, API keys, and other credentials.

**Human-review rule:** AI output is a draft. A PM approves any change order or purchase before action. AI never sends, orders, or commits on its own.

**Approval path for new AI tools**
1. **Request:** the user describes the use case, the data involved, and the expected benefit.
2. **IT/AI manager review:** data classification, security and vendor terms, and cost.
3. **Limited pilot:** a named group, fictional or low-risk data, and a fixed duration.
4. **Scorecard review:** the measures below, against the targets.
5. **Decision:** approve for wider use or retire.

## Pilot scorecard

Targets are illustrative and get set with PMs before the pilot starts.

| Metric | How measured | Target (illustrative) | Source |
|---|---|---|---|
| Reports processed | Job Log rows with Status = Processed | 90% of submissions | Dashboard |
| PM minutes saved per report | Timed sample, before vs after; assumes 15 min until measured | ≥ 10 min | PM time study |
| Extraction accuracy | Weekly spot check of 10 reports: correct fields ÷ total fields | ≥ 90% | Spot-check log |
| Change orders caught earlier | Days from field event to CO start, vs baseline | 3+ days earlier | Flags tab vs CO log |
| Material shortages flagged | Shortage flags raised and approved | Tracked, no target | Flags tab |
| Foreman adoption % | Active foremen submitting ÷ active foremen | ≥ 80% by week 4 | Job Log vs crew roster |
| Errors / corrections | Needs review rows plus PM-corrected fields ÷ reports | ≤ 10% | Job Log, spot-check log |
