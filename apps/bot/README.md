# @aisecretary/bot

Meeting-bot worker that joins Zoom and Microsoft Teams calls on behalf of a tenant, plays the TTS consent disclosure, captures audio, and streams it to storage for downstream transcription. Region-pinned: per-region Zoom Server-to-Server OAuth and Teams app-only Graph credentials — never mix regions.

See `docs/architecture.md` § Bot Architecture and the consent rules in `CLAUDE.md` § Consent & disclosure.
