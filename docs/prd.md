# PRD: Field-to-Office

A demo for the Operational System Applications & AI Manager application at United Electric Company. All data is fictional.

## Problem
Foremen report the day on paper, by text, or not at all. PMs retype the reports, photos stay on phones, change-order work is noticed late, and material shortages are found on site. The cost is admin time, lost change-order revenue, and idle crews.

## Goals
- A foreman submits a daily report (text, photos, voice) from a phone in under 3 minutes.
- Each report becomes a structured Job Log row, crew hours, and filed Drive documents, with no retyping.
- Possible change orders and material shortages are flagged the same day for PM approval.
- Every submission is kept, even when the AI fails.
- A Dashboard shows the day and the pilot scorecard.
- It sets up in a fresh Google account in about 10 minutes.

## Non-goals
- Email or chat intake
- A web-app dashboard
- Roles beyond Google sharing
- Any automatic action on flags
- Production hardening
- Real company data

## Users
- **Foreman:** submits reports.
- **PM:** reviews summaries and approves or rejects flags.
- **Ops/AI manager:** owns setup, governance, and the scorecard.

## Success metrics (demo)
- 3 sample reports and 1 live submission are processed during the demo.
- At least 1 change-order flag and 1 shortage flag are raised and reviewed live.
- A forced Gemini failure still logs the row as Needs review.
- The scorecard is visible. Full pilot metrics are in the [AI use policy and scorecard](ai-use-policy-and-scorecard.md).

## Spec
[F001 Daily Field Report SPEC](features/F001-daily-field-report/SPEC.md) · [Architecture](architecture.md) · [Process maps](process-maps.md)
