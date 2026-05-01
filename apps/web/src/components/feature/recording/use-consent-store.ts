/**
 * Local consent store — captures per-meeting consent acknowledgments
 * during the recording lifecycle. Real persistence to the API endpoint
 * lands in Story 1.4 follow-up.
 *
 * TODO(Story 1.4 follow-up): POST to /api/v1/consents.
 *
 * Kept in `useState` (lightest path) — there's no cross-component
 * subscription requirement yet. When the persistence epic ships we'll
 * promote to Zustand or React Query depending on the read pattern.
 */

import type { ConsentRecord } from '@aisecretary/consent';
import { useCallback, useState } from 'react';

export interface UseConsentStore {
  records: ConsentRecord[];
  add: (record: ConsentRecord) => void;
  reset: () => void;
}

export function useConsentStore(): UseConsentStore {
  const [records, setRecords] = useState<ConsentRecord[]>([]);

  const add = useCallback((record: ConsentRecord) => {
    setRecords((prev) => [...prev, record]);
    // TODO(Story 1.4 follow-up): POST to /api/v1/consents.
  }, []);

  const reset = useCallback(() => setRecords([]), []);

  return { records, add, reset };
}
