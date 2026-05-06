import type { Meta, StoryObj } from '@storybook/react';

import { RelationshipBrowser } from './relationship-browser';

const meta: Meta<typeof RelationshipBrowser> = {
  title: 'Feature/Relationships/RelationshipBrowser',
  component: RelationshipBrowser,
  parameters: {
    docs: {
      description: {
        component:
          'Story 6.4 — faceted browser over the user\'s corpus by people / calendars / projects. Anti-pattern guard: UX spec § Step 5 #17 forbids "timestamp-only meeting IA" — relationships are first-class indices.',
      },
    },
  },
  args: {
    onFilter: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof RelationshipBrowser>;

const populatedFacets = {
  people: [
    { id: 'p1', label: 'Sample Person', count: 12 },
    { id: 'p2', label: 'Casey Lee', count: 7 },
    { id: 'p3', label: 'Sam Rivera', count: 4 },
  ],
  calendars: [
    { id: 'cal-google', label: 'Google Workspace', count: 18 },
    { id: 'cal-microsoft', label: 'Microsoft 365', count: 5 },
  ],
  projects: [
    { id: 'proj-q4', label: 'Q4 launch', count: 5 },
    { id: 'proj-onboard', label: 'Onboarding revamp', count: 3 },
  ],
};

export const Populated: Story = { args: { facets: populatedFacets } };

export const Empty: Story = {
  args: { facets: { people: [], calendars: [], projects: [] } },
};

export const ActiveFilter: Story = {
  args: {
    facets: populatedFacets,
    activeFilter: { kind: 'people', id: 'p1' },
  },
};
