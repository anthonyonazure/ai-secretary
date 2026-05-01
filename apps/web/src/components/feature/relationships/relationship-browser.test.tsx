import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RelationshipBrowser } from './relationship-browser';

const facets = {
  people: [
    { id: 'p1', label: 'Anthony Clendenen', count: 12 },
    { id: 'p2', label: 'Casey Lee', count: 7 },
  ],
  calendars: [{ id: 'cal-google', label: 'Google Workspace', count: 18 }],
  projects: [
    { id: 'proj-q4', label: 'Q4 launch', count: 5 },
    { id: 'proj-onboard', label: 'Onboarding revamp', count: 3 },
  ],
};

describe('RelationshipBrowser', () => {
  it('renders the People tab by default with the count chip', () => {
    render(<RelationshipBrowser facets={facets} onFilter={() => {}} />);
    expect(screen.getByTestId('relationship-tab-people')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('relationship-people-p1').textContent).toContain('Anthony Clendenen');
  });

  it('switches tabs on click', async () => {
    const user = userEvent.setup();
    render(<RelationshipBrowser facets={facets} onFilter={() => {}} />);
    await user.click(screen.getByTestId('relationship-tab-projects'));
    expect(screen.getByTestId('relationship-tab-projects')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('relationship-projects-proj-q4')).toBeInTheDocument();
  });

  it('calls onFilter with the chosen facet', async () => {
    const onFilter = vi.fn();
    const user = userEvent.setup();
    render(<RelationshipBrowser facets={facets} onFilter={onFilter} />);
    await user.click(screen.getByTestId('relationship-people-p1'));
    expect(onFilter).toHaveBeenCalledWith({ kind: 'people', id: 'p1' });
  });

  it('toggles the filter off when the active facet is clicked again', async () => {
    const onFilter = vi.fn();
    const user = userEvent.setup();
    render(
      <RelationshipBrowser
        facets={facets}
        activeFilter={{ kind: 'people', id: 'p1' }}
        onFilter={onFilter}
      />,
    );
    await user.click(screen.getByTestId('relationship-people-p1'));
    expect(onFilter).toHaveBeenCalledWith(null);
  });

  it('shows the empty state per facet', async () => {
    const user = userEvent.setup();
    const empty = { people: [], calendars: [], projects: [] };
    render(<RelationshipBrowser facets={empty} onFilter={() => {}} />);
    expect(screen.getByText(/No people indexed yet/)).toBeInTheDocument();
    await user.click(screen.getByTestId('relationship-tab-projects'));
    expect(screen.getByText(/No projects indexed yet/)).toBeInTheDocument();
  });
});
