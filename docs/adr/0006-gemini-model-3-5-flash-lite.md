# 0006: Gemini model is gemini-3.5-flash-lite

**Status:** Accepted (supersedes the model choice in [ADR 0003](0003-gemini-multimodal-extraction.md); the rest of 0003 stands)

## Context
ADR 0003 chose `gemini-2.5-flash`. On Cosmo's new AI Studio key (2026-11-03), the API returned 404 "no longer available to new users". According to forge's reading of Google's [deprecations page](https://ai.google.dev/gemini-api/docs/deprecations), the 2.5 models are limited to existing users and `gemini-3.5-flash-lite` is the named replacement. On that model, the live sample reports all processed and both flags showed as Pending.

## Decision
Default to `gemini-3.5-flash-lite`. Read the model id from the optional Script Property `GEMINI_MODEL` so a future deprecation is a settings change, not a code change.

## Reasoning
- It's the named replacement, and it was verified working in the live demo.
- The Flash-Lite tier is fast and cheap enough for a per-submission trigger.
- A configurable model id turns the next deprecation into a one-line settings change.

## Rejected alternatives and why
- **Keep gemini-2.5-flash:** unavailable to new API users.
- **A larger, higher-tier model:** slower and costlier, with no evidence the demo needs it.
- **Hard-code the new id with no override:** repeats the failure we just hit.

## Consequences
- Extraction quality on photos and audio should be spot-checked in the live run (AT5-AT7).
- `temperature` is ignored by 3.5 Flash-Lite, per forge's reading of Google's migration guide, so the spec no longer sets it. Determinism relies on the `responseSchema`.
- Production still uses Vertex AI, per ADR 0003.
