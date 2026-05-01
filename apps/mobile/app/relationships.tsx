import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  type RelationshipKind,
  type RelationshipNode,
  deriveRelationshipBrowserState,
  formatLastMeeting,
} from '../hooks/use-relationship-browser-state';

const KIND_FILTERS: ReadonlyArray<{ id: RelationshipKind | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'colleague', label: 'Colleagues' },
  { id: 'customer', label: 'Customers' },
  { id: 'patient', label: 'Patients' },
  { id: 'student', label: 'Students' },
];

const SAMPLE_NODES: ReadonlyArray<RelationshipNode> = [
  {
    id: 'r-1',
    displayName: 'Casey Lin',
    kind: 'colleague',
    meetingCount: 14,
    lastMeetingAtMs: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'r-2',
    displayName: 'Acme Corp — Priya',
    kind: 'customer',
    meetingCount: 6,
    lastMeetingAtMs: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'r-3',
    displayName: 'Patient #4421',
    kind: 'patient',
    meetingCount: 3,
    lastMeetingAtMs: Date.now() - 30 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'r-4',
    displayName: 'Section 4 — CalcII',
    kind: 'student',
    meetingCount: 12,
    lastMeetingAtMs: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
];

export default function RelationshipsScreen() {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<RelationshipKind | 'all'>('all');
  const [sortKey, setSortKey] = useState<'meetings' | 'recency' | 'name'>('recency');

  const state = useMemo(
    () =>
      deriveRelationshipBrowserState({
        nodes: SAMPLE_NODES,
        query,
        kindFilter,
        sortKey,
      }),
    [query, kindFilter, sortKey],
  );

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'Relationships', headerShown: true }} />

      <View className="px-4 py-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name…"
          placeholderTextColor="#999"
          className="rounded-md border border-border bg-surface p-3 text-fg"
          testID="relationships-search-input"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        className="border-border border-b py-2"
      >
        {KIND_FILTERS.map((f) => {
          const active = kindFilter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setKindFilter(f.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`rounded-full border px-3 py-1.5 ${
                active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
              }`}
            >
              <Text className={`text-xs ${active ? 'text-fg' : 'text-fg-muted'}`}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="flex-row gap-2 px-4 py-2">
        {(['recency', 'meetings', 'name'] as const).map((key) => {
          const active = sortKey === key;
          return (
            <Pressable
              key={key}
              onPress={() => setSortKey(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`rounded-full px-3 py-1 ${active ? 'bg-accent-soft' : 'bg-transparent'}`}
            >
              <Text className={`text-[11px] ${active ? 'text-fg' : 'text-fg-muted'}`}>
                Sort: {key}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-4">
        {state.emptyCopy ? (
          <Text className="mt-8 text-center text-fg-muted" testID="relationships-empty">
            {state.emptyCopy}
          </Text>
        ) : (
          state.visibleNodes.map((node) => (
            <View
              key={node.id}
              className="mb-3 rounded-md border border-border bg-surface p-4"
              testID={`relationship-${node.id}`}
            >
              <Text className="text-base font-semibold text-fg">{node.displayName}</Text>
              <Text className="mt-1 text-xs text-fg-muted">
                {node.kind} · {node.meetingCount} meeting{node.meetingCount === 1 ? '' : 's'} ·{' '}
                {formatLastMeeting(node.lastMeetingAtMs)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
