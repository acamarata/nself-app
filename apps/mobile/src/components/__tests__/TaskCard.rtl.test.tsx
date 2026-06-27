/**
 * Purpose: RTL behaviour tests for TaskCard — Hijri vs ISO date display, Arabic title rendering.
 * Inputs: I18nManager.isRTL flag; formatHijriDate mock; task fixture with Arabic title.
 * Outputs: Verified LTR (ISO date with "Due:" prefix), RTL (Hijri date without prefix),
 *          formatHijriDate call args, Arabic title render, and RTL snapshot.
 * Constraints:
 *   - jest.mock() before imports per jest-expo constraint.
 *   - I18nManager.isRTL is set directly on the React Native module (no forceRTL call).
 *   - No AI attribution.
 * SPORT: T-P3-E6-W1-S3-T02 RTL+Hijri
 */

import React from 'react';
import { I18nManager } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('../../i18n', () => ({
  formatHijriDate: jest.fn((_date: string, _locale: string) => '19 Dhul-Hijja 1447'),
}));

import { TaskCard } from '../../components/TaskCard';
import { formatHijriDate } from '../../i18n';

const formatHijriDateMock = formatHijriDate as jest.MockedFunction<typeof formatHijriDate>;

// ── Fixture ───────────────────────────────────────────────────────────────────

const baseTask: any = {
  id: 'task-rtl-1',
  title: 'اجتماع فريق العمل',
  completed: false,
  list_id: 'list-rtl',
  priority: 'high',
  position: 0,
  due_date: '2026-06-19T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  user_id: 'user-rtl',
  description: '',
  is_public: false,
  notes: '',
  source_account_id: 'primary',
  requires_approval: false,
  requires_photo: false,
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejected_at: null,
  rejection_reason: null,
};

const noop = () => {};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  I18nManager.isRTL = false;
  jest.clearAllMocks();
});

afterEach(() => {
  I18nManager.isRTL = false;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskCard: LTR mode (isRTL = false)', () => {
  it('renders "Due: 2026-06-19" with the Due: prefix in LTR mode', () => {
    I18nManager.isRTL = false;

    const { getByText } = render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
    );

    expect(getByText('Due: 2026-06-19')).toBeTruthy();
  });

  it('does not call formatHijriDate in LTR mode', () => {
    I18nManager.isRTL = false;

    render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
    );

    expect(formatHijriDateMock).not.toHaveBeenCalled();
  });

  it('renders the Arabic task title in LTR mode', () => {
    I18nManager.isRTL = false;

    const { getByText } = render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
    );

    expect(getByText('اجتماع فريق العمل')).toBeTruthy();
  });
});

describe('TaskCard: RTL mode (isRTL = true)', () => {
  it('renders the Hijri date "19 Dhul-Hijja 1447" without "Due:" prefix in RTL mode', () => {
    I18nManager.isRTL = true;

    const { getByText, queryByText } = render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
    );

    expect(getByText('19 Dhul-Hijja 1447')).toBeTruthy();
    expect(queryByText(/Due:/)).toBeNull();
  });

  it('calls formatHijriDate with (isoDate, "ar") in RTL mode', () => {
    I18nManager.isRTL = true;

    render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
    );

    expect(formatHijriDateMock).toHaveBeenCalledWith('2026-06-19', 'ar');
  });

  it('renders the Arabic task title in RTL mode', () => {
    I18nManager.isRTL = true;

    const { getByText } = render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
    );

    expect(getByText('اجتماع فريق العمل')).toBeTruthy();
  });

  it('RTL snapshot: toJSON() captures the full component tree in RTL mode', () => {
    I18nManager.isRTL = true;

    const component = render(
      <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
    );

    expect(component.toJSON()).toMatchSnapshot();
  });
});
