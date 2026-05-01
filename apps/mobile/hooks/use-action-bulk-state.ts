export type ActionItemSelection = {
  id: string;
  status: 'open' | 'in-progress' | 'done' | 'blocked';
  ownerUserId: string | null;
};

export type BulkActionInput = {
  selectedIds: ReadonlyArray<string>;
  items: ReadonlyArray<ActionItemSelection>;
};

export type BulkActionAvailability = {
  canMarkDone: boolean;
  canMarkInProgress: boolean;
  canReassign: boolean;
  canDelete: boolean;
  selectedCount: number;
  mixedStatuses: boolean;
};

export const deriveBulkActionAvailability = (input: BulkActionInput): BulkActionAvailability => {
  const set = new Set(input.selectedIds);
  const selected = input.items.filter((i) => set.has(i.id));
  if (selected.length === 0) {
    return {
      canMarkDone: false,
      canMarkInProgress: false,
      canReassign: false,
      canDelete: false,
      selectedCount: 0,
      mixedStatuses: false,
    };
  }
  const statuses = new Set(selected.map((s) => s.status));
  const mixedStatuses = statuses.size > 1;
  return {
    canMarkDone: !statuses.has('done') || mixedStatuses,
    canMarkInProgress: !(statuses.size === 1 && statuses.has('in-progress')),
    canReassign: true,
    canDelete: true,
    selectedCount: selected.length,
    mixedStatuses,
  };
};
