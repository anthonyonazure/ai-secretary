export type ExportFormat = 'transcript-txt' | 'summary-md' | 'analysis-json' | 'audio-mp3';

export type ExportRecord = {
  meetingId: string;
  format: ExportFormat;
  startedAtMs: number;
  completedAtMs: number | null;
  failedReason: string | null;
};

export type ExportInput = {
  meetingId: string;
  recentExports: ReadonlyArray<ExportRecord>;
  isClinicalVertical: boolean;
  hasAnalysis: boolean;
  now?: number;
};

export type ExportFormatAvailability = {
  format: ExportFormat;
  enabled: boolean;
  reason: string | null;
  inFlight: boolean;
  lastFailedReason: string | null;
};

export type ExportStateResult = {
  formats: ReadonlyArray<ExportFormatAvailability>;
  cooldownMsRemaining: number;
};

const COOLDOWN_MS = 30_000;

export const deriveMeetingExportState = (input: ExportInput): ExportStateResult => {
  const now = input.now ?? Date.now();
  const meetingExports = input.recentExports.filter((r) => r.meetingId === input.meetingId);

  const lastSuccess = meetingExports
    .filter((r) => r.completedAtMs !== null)
    .map((r) => r.completedAtMs ?? 0)
    .sort((a, b) => b - a)[0];
  const cooldownMsRemaining =
    lastSuccess !== undefined ? Math.max(0, COOLDOWN_MS - (now - lastSuccess)) : 0;

  const isInFlight = (format: ExportFormat): boolean =>
    meetingExports.some((r) => r.format === format && r.completedAtMs === null);

  const lastFailedFor = (format: ExportFormat): string | null => {
    const matches = meetingExports.filter((r) => r.format === format && r.failedReason !== null);
    if (matches.length === 0) return null;
    const latest = matches.sort((a, b) => b.startedAtMs - a.startedAtMs)[0];
    return latest?.failedReason ?? null;
  };

  const formats: ExportFormatAvailability[] = [
    {
      format: 'transcript-txt',
      enabled: cooldownMsRemaining === 0,
      reason: cooldownMsRemaining > 0 ? 'cooldown' : null,
      inFlight: isInFlight('transcript-txt'),
      lastFailedReason: lastFailedFor('transcript-txt'),
    },
    {
      format: 'summary-md',
      enabled: cooldownMsRemaining === 0,
      reason: cooldownMsRemaining > 0 ? 'cooldown' : null,
      inFlight: isInFlight('summary-md'),
      lastFailedReason: lastFailedFor('summary-md'),
    },
    {
      format: 'analysis-json',
      enabled: input.hasAnalysis && cooldownMsRemaining === 0,
      reason: !input.hasAnalysis ? 'no-analysis-yet' : cooldownMsRemaining > 0 ? 'cooldown' : null,
      inFlight: isInFlight('analysis-json'),
      lastFailedReason: lastFailedFor('analysis-json'),
    },
    {
      format: 'audio-mp3',
      enabled: !input.isClinicalVertical && cooldownMsRemaining === 0,
      reason: input.isClinicalVertical
        ? 'clinical-restriction'
        : cooldownMsRemaining > 0
          ? 'cooldown'
          : null,
      inFlight: isInFlight('audio-mp3'),
      lastFailedReason: lastFailedFor('audio-mp3'),
    },
  ];

  return { formats, cooldownMsRemaining };
};
