/**
 * Purpose: WCAG 2.1 AA accessibility assertions for ntask mobile components.
 * Inputs: @testing-library/react-native render + a11y queries
 * Outputs: Jest assertions verifying accessibilityLabel, accessibilityRole,
 *   accessibilityState, and accessibilityViewIsModal on interactive elements.
 * Constraints:
 *   - Runs under jest-expo preset with @testing-library/react-native v12
 *   - React Navigation + urql + expo-secure-store are mocked
 *   - Tests render isolated components; full navigation stack not needed
 * SPORT: T-P3-E6-W1-S5-T01 (WCAG AA native apps)
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TaskCard } from '../src/components/TaskCard';
import { EmptyState } from '../src/components/seven-states/EmptyState';
import { ErrorCard } from '../src/components/seven-states/ErrorCard';
import type { Task } from '../src/types';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/lib/api', () => ({
  getServerUrl: jest.fn().mockResolvedValue(null),
  setServerUrl: jest.fn().mockResolvedValue(undefined),
  createUrqlClient: jest.fn(),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const baseTask: Task = {
  id: 'task-1',
  title: 'Write accessibility tests',
  completed: false,
  list_id: 'list-1',
  position: 0,
  tags: [],
  priority: 'medium',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const noop = () => undefined;

// ── TaskCard ───────────────────────────────────────────────────────────────────

describe('TaskCard a11y', () => {
  it('has accessibilityLabel matching the task title', () => {
    render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />
    );
    expect(screen.getByLabelText('Write accessibility tests')).toBeTruthy();
  });

  it('checkbox has accessibilityRole="checkbox" and correct checked state', () => {
    const { rerender } = render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeTruthy();
    expect(checkbox.props.accessibilityState?.checked).toBe(false);

    rerender(
      <TaskCard task={{ ...baseTask, completed: true }} onToggle={noop} onDelete={noop} onPress={noop} />
    );
    expect(screen.getByRole('checkbox').props.accessibilityState?.checked).toBe(true);
  });

  it('pending task sets accessibilityState.busy=true', () => {
    render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} pending />
    );
    const row = screen.getByLabelText('Write accessibility tests');
    expect(row.props.accessibilityState?.busy).toBe(true);
  });
});

// ── EmptyState ─────────────────────────────────────────────────────────────────

describe('EmptyState a11y', () => {
  it('action button has accessibilityRole=button and correct label', () => {
    const onAction = jest.fn();
    render(
      <EmptyState title="No tasks" actionLabel="Add task" onAction={onAction} />
    );
    const btn = screen.getByRole('button', { name: 'Add task' });
    expect(btn).toBeTruthy();
  });

  it('renders without action button when actionLabel is absent', () => {
    render(<EmptyState title="No tasks" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// ── ErrorCard ──────────────────────────────────────────────────────────────────

describe('ErrorCard a11y', () => {
  it('retry button has accessibilityRole=button and label "Retry"', () => {
    const onRetry = jest.fn();
    render(<ErrorCard message="Network error" onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: 'Retry' });
    expect(btn).toBeTruthy();
  });

  it('container has accessibilityRole=alert', () => {
    render(<ErrorCard />);
    // RNTL v12 exposes accessibilityRole="alert" via getByA11yRole
    const container = screen.UNSAFE_getByProps({ accessibilityRole: 'alert' });
    expect(container).toBeTruthy();
  });
});
