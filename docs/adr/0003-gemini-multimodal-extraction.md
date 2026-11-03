# 0003 Gemini multimodal extraction

**Status:** Accepted (model choice superseded by 0006) (2026-11-03)

## Context
Reports mix free text, photos, and voice notes. We need structured output (crew hours, work done, issues, possible change orders, shortages) from one call that Apps Script can make with `UrlFetchApp`.

## Decision
Call Gemini 2.5 Flash (model choice superseded by [ADR 0006](0006-gemini-model-3-5-flash-lite.md)) through the Generative Language REST API, with text, images, and audio sent inline in one request. Enforce a JSON `responseSchema`. The AI Studio API key lives in Script Property `GEMINI_API_KEY` and is never committed.

## Reasoning
- One model handles text, images, and audio. There's no separate transcription step.
- A response schema gives JSON that can be parsed and checked against the SPEC fields.
- Flash is fast and cheap enough for a per-submission trigger, well inside the 6-minute limit.
- It's in the Google ecosystem the company already uses, and the setup is one API key.

## Rejected alternatives and why
- **OpenAI:** capable, but it means a second vendor and a second data-processing agreement outside the Google stack. Audio would also need a separate endpoint.
- **Separate speech-to-text plus an LLM:** two calls, two failure points, and more code and latency. Voice notes are short, so native audio input is enough.
- **Vertex AI with a service account:** **this is the right production path for data governance**, with enterprise terms, no training on data, regional control, and IAM. It needs a GCP project, billing, and service-account OAuth, which is too much setup for tonight.

## Consequences
- AI Studio free-tier terms may allow Google to use inputs, so only fictional data goes in. The policy states this.
- The model can hallucinate. Every flag needs an evidence quote and PM review (ADR 0004).
- Inline payloads are capped (about 20 MB per request). Over 15 MB of attachments falls back to text only.
- Moving to Vertex later changes the endpoint and auth, not the schema.
