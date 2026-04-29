# ADR 0001: Template

> **Copy this file when recording a new architectural decision.**
> Filename pattern: `000N-<short-kebab-name>.md` where N is the next number.

## Status

`PROPOSED` | `ACCEPTED` | `DEPRECATED` | `SUPERSEDED by ADR-NNNN`

## Date

YYYY-MM-DD

## Context

What is the issue motivating this decision or change? Describe the forces at play — technical, business, compliance, team. Reference the section of `docs/architecture.md` this deviates from (or extends).

Example: *"During implementation of the meeting-bot service, we discovered that Zoom Server-to-Server OAuth tokens cannot be renewed without admin re-consent in some account configurations. This blocks Journey J3 for Enterprise Zoom accounts that have disabled long-lived service tokens."*

## Decision

What we are doing — concrete and unambiguous. The change should be implementable from this paragraph alone.

Example: *"We will add a fallback OAuth-User flow for the Zoom integration. Tenants whose Server-to-Server token fails will be prompted to authorize a per-user token via the standard Zoom OAuth flow. Tokens cached in Redis with refresh handled by `apps/bot/src/zoom/auth.ts`."*

## Consequences

### Positive

- What gets better

### Negative

- What gets worse, what trade-offs we accept

### Neutral / informational

- What changes that's neither clearly good nor bad

## Alternatives considered

What else we looked at and why we didn't pick it.

| Option | Why rejected |
|---|---|
| A. Approach X | Reason |
| B. Approach Y | Reason |

## Related

- Architecture section: `docs/architecture.md` § <heading>
- Related ADRs: ADR-NNNN, ADR-NNNN
- Implementation PRs: #NNN, #NNN

## Notes

Anything else worth recording — links to research, prior incidents, external constraints.
