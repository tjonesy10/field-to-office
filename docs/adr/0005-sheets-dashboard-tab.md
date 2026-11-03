# 0005 Sheets dashboard tab

**Status:** Accepted (2026-11-03)

## Context
PMs and the ops/AI manager need a glance view: today's reports, hours by job, open flags, and the pilot scorecard. It has to be built tonight and stay current without code.

## Decision
A `Dashboard` tab in the same Sheet, built only from formulas (FILTER, QUERY, COUNTIF) over the other tabs. No script writes to it after setup.

## Reasoning
- It's always current, with no refresh job and no extra sharing model.
- Anyone can read the formulas, so the numbers can be audited.
- It's the fastest thing to build and the most reliable thing to demo.

## Rejected alternatives and why
- **Looker Studio:** better charts, but it's a separate asset with separate sharing and connector setup, plus refresh caching. That's too much for tonight, and it's overkill at pilot volume.
- **Apps Script web app:** custom HTML, deployment, and access settings make it more code and more to maintain. The SPEC rules out a separate web-app dashboard.

## Consequences
- The charts are basic. Fine for a demo.
- Formulas break if someone renames columns, so headers are fixed in the SPEC.
- Looker Studio can sit on the same Sheet later with no data changes.
