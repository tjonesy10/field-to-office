# 0004 Human-in-the-loop flags

**Status:** Accepted (2026-11-03)

## Context
Possible change orders and material shortages have money and customer impact. AI extraction is probabilistic, and a wrong change order or purchase damages trust with the GC and the customer.

## Decision
The AI only **raises** flags. Each one becomes a `Flags` row with `Status = Pending`, an evidence quote, and fields for the PM's decision (Approved/Rejected, PM note, reviewed by, reviewed at). The system takes no automatic action on any flag.

## Reasoning
- The PM stays accountable for scope and cost decisions, which matches how change orders work contractually.
- Evidence quotes let the PM check a flag in seconds against the foreman's own words.
- Approval and rejection counts measure extraction quality for the pilot scorecard.
- It's the simplest design that is safe to demo.

## Rejected alternatives and why
- **Auto-draft change orders:** risks sending wrong scope or pricing language. It needs contract pricing, which the AI policy keeps out of AI. It also implies authority the AI shouldn't have.
- **Email the PM automatically:** adds noise and a send path to govern, and it's out of scope for the demo. The Dashboard's open-flags list covers awareness. Notifications can come later, after accuracy is measured.

## Consequences
- PMs must check the Flags tab, and the Dashboard shows the open count.
- Approved flags still need manual follow-up (a CO in the PM's normal process).
- Any future automation must keep human approval before external action.
