# Architecture

GitHub auto-renders Mermaid in Markdown; the diagrams below display as
SVGs when this file is opened in the GitHub UI.

## System overview

```mermaid
flowchart TB
    classDef client fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#1e1b4b
    classDef edge   fill:#fafafa,stroke:#09090b,stroke-width:1.5px,color:#09090b
    classDef store  fill:#fef3c7,stroke:#a16207,stroke-width:1.5px,color:#451a03
    classDef worker fill:#fff,stroke:#09090b,stroke-width:1.5px,color:#09090b
    classDef gateway fill:#ede9fe,stroke:#6d28d9,stroke-width:1.5px,color:#3b0764

    Web[apps/web<br/>React 19 + Vite]:::client
    Mobile[apps/mobile<br/>Expo 52]:::client
    Ext[apps/extension<br/>Chrome MV3]:::client

    API[apps/api<br/>Fastify 5<br/>Argon2id + JWT + RLS context]:::edge

    PG[(Postgres 16<br/>+ pgvector + RLS)]:::store
    Redis[(Redis 7<br/>refresh tokens<br/>heartbeat keys)]:::store
    PgBoss[/pg-boss queues<br/>same Postgres/]:::store
    S3[(S3 / MinIO<br/>recordings + DSAR)]:::store

    Workers[apps/workers<br/>transcribe + summarize<br/>+ extract-action-items<br/>+ dsar.export + crm.push]:::worker
    Bot[apps/bot<br/>Zoom + Teams<br/>media bot]:::worker

    LLM[packages/llm-gateway<br/>Anthropic + OpenAI<br/>+ Azure + Bedrock + Ollama]:::gateway
    TR[packages/transcription<br/>Whisper API<br/>+ self-hosted faster-whisper]:::gateway
    CRM[packages/crm<br/>HubSpot + Salesforce<br/>+ Pipedrive]:::gateway
    NOTIF[packages/notifications<br/>Postmark + SES + Expo]:::gateway

    Web -.TLS 1.3.-> API
    Mobile -.TLS 1.3.-> API
    Ext -.TLS 1.3.-> API

    API --> PG
    API --> Redis
    API --> PgBoss
    API --> S3

    PgBoss --> Workers
    PgBoss --> Bot

    Workers --> LLM
    Workers --> TR
    Workers --> CRM
    Workers --> NOTIF
    Bot --> S3
```

## Capture → transcribe → analyze → share

```mermaid
sequenceDiagram
    autonumber
    participant U as User<br/>(web/mobile)
    participant API as apps/api
    participant Q as pg-boss
    participant W as apps/workers
    participant T as Transcription<br/>gateway
    participant L as LLM gateway
    participant DB as Postgres (RLS)

    U->>API: POST /recordings/initiate
    API->>DB: INSERT recordings (status=uploading)
    API-->>U: presigned multipart URLs
    U->>+API: PUT chunks (S3 direct)
    U->>API: POST /recordings/:id/complete
    API->>Q: enqueue transcribe(recordingId, region)
    API->>DB: audit_logs ← recording.completed
    API-->>-U: 202 Accepted

    Q->>W: transcribe job
    W->>T: chatStream(audio)
    T-->>W: speaker_turns (diarized)
    W->>DB: INSERT speaker_turns + meetings.status=transcribed
    W->>Q: enqueue summarize + extract-action-items
    W->>DB: audit_logs ← meeting.transcribed

    Q->>W: summarize job
    W->>L: chat(transcript, module=sales)
    L-->>W: summary + citations
    W->>DB: INSERT module_outputs
    W->>DB: audit_logs ← meeting.summarized

    Q->>W: extract-action-items job
    W->>L: chat(transcript, schema=ActionItems)
    L-->>W: action_items[]
    W->>DB: INSERT action_items
    W->>DB: audit_logs ← meeting.action-items-extracted

    U->>API: GET /meetings/:id/speaker-turns
    API->>DB: SELECT (RLS scoped)
    API-->>U: receipt with citations
```

## Multi-tenant isolation

```mermaid
flowchart LR
    classDef tenant fill:#dbeafe,stroke:#1e3a8a
    classDef rls    fill:#fef3c7,stroke:#a16207
    classDef row    fill:#fff,stroke:#09090b

    Req[HTTP request<br/>JWT.tenant_id = T1]:::tenant

    Plugin[tenant-context plugin<br/>SET app.current_tenant_id<br/>SET app.current_region]:::rls

    Policy[RLS policy<br/>USING tenant_id = current_tenant_id]:::rls

    R1[(meetings row<br/>tenant=T1)]:::row
    R2[(meetings row<br/>tenant=T2)]:::row

    Req --> Plugin
    Plugin --> Policy
    Policy -- visible --> R1
    Policy -. invisible .- R2
```

## Compliance posture routing

```mermaid
flowchart TD
    classDef tenant fill:#dbeafe,stroke:#1e3a8a
    classDef router fill:#ede9fe,stroke:#6d28d9
    classDef provider fill:#fff,stroke:#09090b

    Default[Tenant: posture=default<br/>region=us]:::tenant
    HIPAA[Tenant: posture=hipaa<br/>region=us]:::tenant
    EU[Tenant: posture=default<br/>region=eu]:::tenant
    HIPAA_EU[Tenant: posture=hipaa-eu<br/>region=eu]:::tenant

    Selector[selectLlmProviderKind]:::router

    Anthropic[Anthropic direct]:::provider
    Bedrock_US[AWS Bedrock<br/>us-east-1<br/>BAA]:::provider
    Bedrock_EU[AWS Bedrock<br/>eu-west-1<br/>BAA + SCC]:::provider
    AzureHIPAA[Azure OpenAI<br/>HIPAA + EU<br/>BAA + SCC]:::provider

    Default --> Selector --> Anthropic
    HIPAA --> Selector
    Selector --> Bedrock_US
    EU --> Selector
    Selector --> Bedrock_EU
    HIPAA_EU --> Selector
    Selector --> AzureHIPAA
```

## Bot session FSM (ADR-0006-adjacent pattern)

```mermaid
stateDiagram-v2
    [*] --> provisioning : POST /api/v1/bot-sessions
    provisioning --> joined : provider.join() ok
    provisioning --> failed : refused / timeout / cred missing
    joined --> ended : provider.leave() ok
    joined --> failed : connection lost / abort
    ended --> [*]
    failed --> [*]
```

## Tenant lifecycle FSM (ADR-0004)

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> dpa_required : begin onboarding
    dpa_required --> dpa_accepted : POST /tenants/me/dpa
    dpa_accepted --> region_pinning
    region_pinning --> provisioning : POST /tenants/me/region (one-shot)
    provisioning --> active : disclosure + retention + ≥1 module set
    active --> suspended : admin action / billing
    suspended --> active : admin restore
```
