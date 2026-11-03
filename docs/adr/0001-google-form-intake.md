# 0001 Google Form intake

**Status:** Accepted (2026-11-03)

## Context
Foremen need to send a daily report from a phone on site, with text, photos, and sometimes a voice note. The office needs those reports in a structured, predictable shape. The demo has to be built tonight on Google tools.

## Decision
Foremen submit daily reports through one Google Form. It has fixed fields and optional file uploads for photos and a voice note, and its responses are linked to the project Sheet.

## Reasoning
- Fixed fields (Job, Foreman, date) make job matching certain. The AI only has to read the free text.
- The Form works on any phone browser, needs no app install, and feeds a Sheet natively.
- File upload puts the photos and audio in Drive automatically. Signing in to Google is the price, and it's acceptable for a demo.
- It can be built in minutes and is easy to show live.

## Rejected alternatives and why
- **Gmail intake (email a report address):** subjects and bodies are unstructured, so the job match is a guess. It needs mailbox polling, and attachment and signature parsing are noisy. It's also harder to demo reliably.
- **Google Chat app:** needs a Workspace account and a Chat app configuration in Google Cloud. The bot account is consumer Gmail, so it isn't available tonight. Chat may be the better UX later.
- **AppSheet:** a good mobile form with offline mode, but it's another platform to license and govern. It's also more setup than tonight allows. Revisit it if foremen need offline capture.

## Consequences
- Respondents must sign in to a Google account to upload files.
- `FormApp` can't create file-upload questions, so setup leaves two questions to add by hand.
- Report date can't default to today, so a blank date means the submission date.
- Moving to Chat or email later only changes intake. The processing contract stays the same.
