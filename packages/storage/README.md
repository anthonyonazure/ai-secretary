# @aisecretary/storage

Object-storage abstraction over S3 (default), Azure Blob, GCS, and MinIO (on-prem). Owns presigned-URL generation, resumable-upload coordination, and SSE-KMS encryption-at-rest configuration. Storage SDKs are imported here and **only** here — enforced by Biome rule and CI grep.

See `CLAUDE.md` § Provider abstraction discipline + arch-addendums § Resumable upload retry.
