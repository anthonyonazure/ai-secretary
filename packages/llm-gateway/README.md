# @aisecretary/llm-gateway

Single chokepoint for every LLM call. Wraps Anthropic (default), OpenAI ZDR, Azure OpenAI (HIPAA-eligible), and Ollama (local) behind a unified provider interface. Honors per-tenant compliance posture (`tenant_entitlements`) on every call: medical/behavioral-health → Anthropic via AWS Bedrock with BAA; EU → Anthropic via AWS-EU; embeddings routed to Azure or self-hosted bge-m3 as posture demands.

LLM SDKs are imported here and **only** here — enforced by Biome rule and CI grep. See `CLAUDE.md` § Provider abstraction discipline + § Compliance posture routing.
