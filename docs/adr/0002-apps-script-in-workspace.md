# 0002 Apps Script in Google Workspace tools (build vs buy)

**Status:** Accepted (2026-11-03)

## Context
The role owns business apps and workflow automation on a Google Workspace stack. The demo must be built tonight, run in a personal (consumer) Google account, and need no servers or credentials beyond one API key. It is a show-and-tell piece, not a production purchase.

## Decision
Build the workflow as one Apps Script project bound to the Google Sheet, using an installable `onFormSubmit` trigger and built-in services only.

## Reasoning
- There's nothing to host, patch, or pay for. The code lives next to the data, and Google sharing is the access model.
- It matches the company's stack, so a Workspace admin could adopt the pattern with no new vendor.
- Setup is "paste script, run Setup", which fits the 10-minute goal.
- A build demo shows process thinking: map the workflow, add AI where it saves time, keep a human approving decisions, and measure the result.

## Rejected alternatives and why
- **Hosted Node/Python service:** needs hosting, secrets management, and OAuth to Sheets and Drive. That's too much for tonight, and it adds an ops burden that a small internal tool doesn't justify.
- **AppSheet:** another platform and license. AI extraction would still need a script or an API call.
- **Zapier/Make:** per-task pricing, data passing through a third party, and multi-step file handling that's fragile to demo. It also governs poorly at scale.
- **Buy (Procore or Raken daily logs):** **this is the right call to evaluate for production.** Those tools offer mature daily logs, mobile apps, T&M tickets, and integrations. It was rejected for this demo only, because a demo of a purchased tool shows vendor clicks, not process thinking. The demo doubles as the requirements and scorecard for that buy evaluation.

## Consequences
- Consumer Apps Script limits apply: 6 minutes per run, plus daily UrlFetch and trigger quotas. These are fine at demo volume.
- There's no CI for Apps Script. Tests are live hand-checks against SPEC acceptance tests.
- `clasp` is optional for syncing the repo with the script.
- A production path would be a buy evaluation (Procore/Raken) scored against this pilot's metrics.
