/**
 * Local consent store — captures per-meeting consent acknowledgments
 * during the recording lifecycle. Real persistence to the API endpoint
 * lands in Story 1.4 follow-up.
 *
 * TODO(Story 1.4 follow-up): POST to /api/v1/consents.
 *
 * Mirrors the web `useConsentStore` so the wiring contract stays
 * identical across surfaces.
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
