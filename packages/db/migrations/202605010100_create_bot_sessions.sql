-- Story 9.x — bot session FSM table.
--
-- Producer-side persistence for the meeting-bot subsystem. Pairs with
-- the `bot-watchdog` worker handler (apps/workers/src/handlers/bot-watchdog.ts)
-- which already expects rows shaped exactly like this — the table is
-- the receive-side substrate's source of truth for the
-- `BotWatchdogReader.listInFlight()` call.
--
-- FSM (mirrored in packages/bot/src/fsm.ts):
--   provisioning → joined → ended         (clean leave)
--   provisioning → failed                  (join refused / cred error)
--   joined        → failed                 (lost connection / aborted)
--
-- `failed` is the audit-visible terminal that drives the user-facing
-- "bot couldn't join" notification + the cloud-recording fallback path
-- (Story 9.6).

CREATE TYPE bot_source AS ENUM ('zoom_bot', 'teams_bot');
CREATE TYPE bot_session_status AS ENUM ('provisioning', 'joined', 'ended', 'failed');
CREATE TYPE bot_region AS ENUM ('us', 'eu');

CREATE TABLE bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  /* Nullable on creation — the meeting row may be created together with
     the bot session, or the bot may attach to a later meeting upload. */
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  source bot_source NOT NULL,
  status bot_session_status NOT NULL DEFAULT 'provisioning',
  region bot_region NOT NULL,
  /* Provider-native meeting handle. For Zoom: meeting number. For Teams:
     online-meeting ID or join URL. Opaque to the platform. */
  external_meeting_id TEXT NOT NULL,
  /* Optional pre-shared passcode. Zoom requires it for password-gated
     meetings; never returned in responses. */
  external_meeting_passcode TEXT,
  joined_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  /* Populated only on transitions into `failed`. */
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Watchdog scan: status ∈ provisioning|joined AND created_at within 24h.
   Tenant-leading is the convention because RLS forces tenant_id every
   time. */
CREATE INDEX idx_bot_sessions_tenant_status_created
  ON bot_sessions (tenant_id, status, created_at DESC);

/* Per-meeting lookups — one bot session per meeting is typical but not
   enforced here (a flaky network can produce a re-join). */
CREATE INDEX idx_bot_sessions_tenant_meeting
  ON bot_sessions (tenant_id, meeting_id)
  WHERE meeting_id IS NOT NULL;

/* Owner's "my bot sessions" filter — drives mobile/web bot-status UI. */
CREATE INDEX idx_bot_sessions_tenant_owner_created
  ON bot_sessions (tenant_id, owner_user_id, created_at DESC);
