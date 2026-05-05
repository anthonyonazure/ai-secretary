# Data Processing Addendum (DPA) — Template

> **Disclaimer:** This template is provided as portfolio scaffolding,
> not legal advice. Production use requires review by qualified
> counsel in each jurisdiction the tenant operates in. The terms below
> reflect AI Secretary's standard processor obligations and align with
> EU GDPR, UK GDPR, and (where the BAA is also signed) HIPAA.

---

## Data Processing Addendum

This Data Processing Addendum ("**DPA**") forms part of the
Subscription Agreement between **AI Secretary, Inc.** ("**Processor**")
and the customer identified in the Order Form ("**Controller**" or
"**Customer**") and applies when Processor processes Personal Data on
behalf of Controller.

### 1. Definitions

Capitalized terms not defined here have the meanings given in the GDPR.

- **Personal Data** — any information relating to an identified or
  identifiable natural person processed under the Subscription.
- **Sub-processor** — any third party engaged by Processor to process
  Personal Data on its behalf.
- **Restricted Transfer** — a transfer of Personal Data to a country
  outside the EEA or UK that is not the subject of an adequacy
  decision.

### 2. Scope and Roles

2.1 Processor will process Personal Data only as a processor on behalf
of Controller, in accordance with Controller's documented instructions
and this DPA.

2.2 The categories of data subjects, types of Personal Data, and
purposes of processing are described in **Annex I**.

### 3. Processor Obligations

Processor shall:

3.1 Process Personal Data only on documented instructions from
Controller (including for Restricted Transfers) unless required to do
so by Union or Member State law to which Processor is subject.

3.2 Ensure persons authorized to process Personal Data have committed
themselves to confidentiality.

3.3 Take all measures required pursuant to Article 32 of the GDPR
(security of processing). Processor's technical and organizational
measures are described in **Annex II**.

3.4 Engage Sub-processors only with Controller's prior general written
authorization, subject to Section 5.

3.5 Taking into account the nature of the processing, assist Controller
by appropriate technical and organizational measures, insofar as
possible, for the fulfillment of Controller's obligation to respond to
requests for exercising the data subject's rights under Chapter III of
the GDPR.

3.6 Assist Controller in ensuring compliance with the obligations
pursuant to Articles 32 to 36 of the GDPR taking into account the
nature of processing and the information available to Processor.

3.7 At Controller's choice, delete or return all Personal Data to
Controller after the end of the provision of services relating to
processing, and delete existing copies unless Union or Member State
law requires storage of the Personal Data.

3.8 Make available to Controller all information necessary to
demonstrate compliance with the obligations laid down in Article 28 of
the GDPR and allow for and contribute to audits, including inspections,
conducted by Controller or another auditor mandated by Controller.

### 4. Security

4.1 The technical and organizational measures (**Annex II**) include,
without limitation:

- (a) Encryption of Personal Data at rest (AES-256-GCM with KMS-style
  envelope encryption) and in transit (TLS 1.3).
- (b) Multi-tenant isolation enforced at the database row level (RLS).
- (c) Region pinning for EU tenants (eu-west-1) with a database trigger
  preventing region changes after the one-shot pin.
- (d) Append-only audit log of every state-changing operation, with
  SQL-level immutability.
- (e) Per-tenant key separation for at-rest encryption of Sub-processor
  credentials.
- (f) MFA-enforceable authentication with TOTP fallback.

4.2 Processor will notify Controller without undue delay (and in any
event within 48 hours) after becoming aware of a Personal Data Breach
affecting Controller's data.

### 5. Sub-processors

5.1 Controller authorizes Processor to engage the Sub-processors
listed at https://aisecretary.app/legal/subprocessors.

5.2 Processor will notify Controller of any intended additions or
replacements of Sub-processors at least 30 days before the change
takes effect, giving Controller the opportunity to object.

5.3 Processor will impose data protection obligations on each
Sub-processor materially equivalent to those in this DPA.

### 6. International Transfers

6.1 The 2021 EU Standard Contractual Clauses (SCC), Module 2
(Controller-to-Processor), are hereby incorporated by reference and
apply to any Restricted Transfer between Controller (data exporter)
and Processor (data importer). The Schedules to the SCC are completed
in **Annex III**.

6.2 For UK transfers, the Information Commissioner's Office (ICO)
International Data Transfer Addendum to the EU SCC applies.

### 7. Data Subject Rights

7.1 Processor will assist Controller, by appropriate technical and
organizational measures, with the fulfillment of Controller's obligation
to respond to requests under Articles 12–22 of the GDPR. Processor
provides a self-service Data Subject Access Request portal at
https://app.aisecretary.app/data-rights.

### 8. Audit Rights

8.1 Controller may, at its expense and on reasonable notice, audit
Processor's compliance with this DPA, subject to Processor's
confidentiality and security requirements. Audit rights may be
satisfied by Processor's then-current SOC 2 Type II report.

### 9. Liability + Term

9.1 The liability provisions of the Subscription Agreement apply to
this DPA.

9.2 This DPA terminates upon termination of the Subscription Agreement.
Sections 3.7 and 4.2 survive termination.

---

## Annex I — Subject-matter, Duration, Nature, Purpose, Categories

### Subject-matter and duration of the processing

The provision of AI Secretary's meeting-intelligence platform for the
duration of the Subscription Agreement.

### Nature and purpose of the processing

To capture, transcribe, analyze, and surface meeting content for the
benefit of Controller's authorized users, in accordance with the
configured vertical (sales, HR, education, medical, support, PM,
psychology, general).

### Types of Personal Data

- Identification: name, email, employer, role
- Audio recordings of meetings
- Transcripts derived from those recordings
- AI-generated summaries, action items, and analysis outputs
- Metadata: timestamps, device fingerprint (cellular network only),
  IP address (audit log only)

### Categories of data subjects

- Controller's employees, contractors, and authorized agents
- Meeting participants (internal and external)
- Recipients of shared meeting receipts

### Special categories of Personal Data (Art. 9)

When the medical or psychology verticals are enabled, processing may
include health data within the meaning of Art. 9(1) GDPR. Processor
provides this Special Category processing only under a Business
Associate Agreement (where HIPAA applies) or under explicit consent
captured per Art. 9(2)(a) GDPR.

---

## Annex II — Technical and Organisational Measures

| Category | Measure |
|---|---|
| Pseudonymisation | UUIDs everywhere; logs strip PII |
| Encryption at rest | AES-256-GCM with envelope encryption (rotatable KEK) |
| Encryption in transit | TLS 1.3; HSTS preload; mTLS internal |
| Confidentiality | Postgres RLS on every tenant-scoped table |
| Integrity | GCM auth tags; FK + enum DB constraints; append-only audit log |
| Availability | Postgres PITR; multi-AZ; S3 versioning |
| Resilience | Auto-scale workers; pg-boss retry budgets |
| Restoration | Documented runbooks; RPO 5 min, RTO 1 hour |
| Effectiveness testing | 1700+ automated tests; CI provider-isolation gates |
| Access control | Argon2id passwords; MFA TOTP; per-region JWT secrets |
| Logging + monitoring | pino → Grafana Cloud; Sentry alerts |
| Incident response | 48-hour breach notification; documented runbooks |
| Subprocessor management | DPA + SCC + (where applicable) BAA with each |
| Region pinning | DB trigger enforces immutability post-pin |
| Sub-processor encryption | CRM OAuth tokens stored envelope-encrypted; LLM providers under ZDR contract |

---

## Annex III — SCC Schedules

### A. List of Parties

- **Data Exporter:** Controller (as identified in the Order Form).
  Role: Controller.
- **Data Importer:** AI Secretary, Inc., 1234 Example Way, Phoenix, AZ
  85001 USA. Role: Processor.

### B. Description of Transfer

See Annex I.

### C. Competent Supervisory Authority

The supervisory authority of the EU Member State in which the data
exporter is established (or, if the exporter is established outside
the EU, the supervisory authority of the EU representative).

### D. Technical and Organisational Measures

See Annex II.

### E. Sub-processors

Listed at https://aisecretary.app/legal/subprocessors.
