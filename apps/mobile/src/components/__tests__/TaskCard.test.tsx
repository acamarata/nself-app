/**
 * Purpose: Unit tests for TaskCard — title, completion style, pending state, checkbox toggle, due date, RTL, priority dot.
 * Inputs: mocked i18n.formatHijriDate; I18nManager.isRTL toggled per test.
 * Outputs: jest assertions on rendering and callback calls.
 * Constraints: Runs under jest-expo preset; no real i18n or native modules.
 * SPORT: P5-C-task-card
 */
import React from 'react';
import { I18nManager } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../i18n', () => ({
  formatHijriDate: jest.fn(() => '١٩ ذو الحجة ١٤٤٧'),
  initializeI18n: jest.fn(),
  getDeviceLocale: jest.fn(() => 'en'),
}));

import { TaskCard } from '../TaskCard';

/** Minimal NpTask fixture — extend per test as needed */
const baseTask: any = {
  id: 'task-1',
  title: 'Buy groceries',
  completed: false,
  list_id: 'list-1',
  priority: 'none',
  position: 0,
  due_date: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  user_id: 'user-1',
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

const noop = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  // Ensure LTR for each test unless the test overrides it
  I18nManager.isRTL = false;
});

afterEach(() => {
  I18nManager.isRTL = false;
});

describe('TaskCard', () => {
  describe('title rendering', () => {
    it('renders the task title', () => {
      const { getByText } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      expect(getByText('Buy groceries')).toBeTruthy();
    });

    it('renders with completed=true without crashing', () => {
      const task = { ...baseTask, completed: true };
      const { getByText } = render(
        <TaskCard task={task} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      // Title should still be visible (with strikethrough style applied by the component)
      expect(getByText('Buy groceries')).toBeTruthy();
    });

    it('title text element has line-through style when completed=true', () => {
      const task = { ...baseTask, completed: true };
      const { getByText } = render(
        <TaskCard task={task} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      const titleEl = getByText('Buy groceries');
      // Style may be an array; flatten and check for line-through
      const flatStyle = [titleEl.props.style].flat();
      const hasStrikethrough = flatStyle.some(
        (s: any) => s && s.textDecorationLine === 'line-through',
      );
      expect(hasStrikethrough).toBe(true);
    });
  });

  describe('pending state', () => {
    it('renders "Saving…" label when pending=true', () => {
      const { getByText } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} pending />,
      );
      expect(getByText('Saving…')).toBeTruthy();
    });

    it('does not render "Saving…" when pending=false', () => {
      const { queryByText } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} pending={false} />,
      );
      expect(queryByText('Saving…')).toBeNull();
    });

    it('renders ActivityIndicator instead of checkbox when pending=true', () => {
      const { UNSAFE_getByType } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} pending />,
      );
      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });

  describe('checkbox', () => {
    it('pressing checkbox calls onToggle(true) when task.completed=false', () => {
      const onToggle = jest.fn();
      const { getByRole } = render(
        <TaskCard task={baseTask} onToggle={onToggle} onDelete={noop} onPress={noop} />,
      );
      const checkbox = getByRole('checkbox');
      fireEvent.press(checkbox);
      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('pressing checkbox calls onToggle(false) when task.completed=true', () => {
      const onToggle = jest.fn();
      const task = { ...baseTask, completed: true };
      const { getByRole } = render(
        <TaskCard task={task} onToggle={onToggle} onDelete={noop} onPress={noop} />,
      );
      const checkbox = getByRole('checkbox');
      fireEvent.press(checkbox);
      expect(onToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('row press', () => {
    it('pressing the row calls onPress when pending=false', () => {
      const onPress = jest.fn();
      const { getByLabelText } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={onPress} pending={false} />,
      );
      fireEvent.press(getByLabelText('Buy groceries'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('due date', () => {
    it('renders the ISO due date in LTR mode', () => {
      const task = { ...baseTask, due_date: '2026-12-31T00:00:00Z' };
      const { getByText } = render(
        <TaskCard task={task} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      expect(getByText(/2026-12-31/)).toBeTruthy();
    });

    it('calls formatHijriDate and renders Hijri date in RTL mode', () => {
      I18nManager.isRTL = true;
      const { formatHijriDate } = require('../../i18n');
      const task = { ...baseTask, due_date: '2026-12-31T00:00:00Z' };
      const { getByText } = render(
        <TaskCard task={task} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      expect(formatHijriDate).toHaveBeenCalledWith('2026-12-31', 'ar');
      expect(getByText('١٩ ذو الحجة ١٤٤٧')).toBeTruthy();
    });

    it('does not render a due date element when due_date is null', () => {
      const { queryByText } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      expect(queryByText(/Due:/)).toBeNull();
    });
  });

  describe('priority dot', () => {
    it('renders priority dot when priority="high"', () => {
      const task = { ...baseTask, priority: 'high' };
      const { UNSAFE_getAllByType } = render(
        <TaskCard task={task} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      const { View } = require('react-native');
      // Look for a View whose backgroundColor matches the high-priority color (#ef4444)
      const allViews = UNSAFE_getAllByType(View);
      const dotView = allViews.find(
        (v: any) =>
          [v.props.style].flat().some(
            (s: any) => s && s.backgroundColor === '#ef4444',
          ),
      );
      expect(dotView).toBeTruthy();
    });

    it('does not render a colored priority dot when priority="none"', () => {
      const { UNSAFE_getAllByType } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      const { View } = require('react-native');
      const allViews = UNSAFE_getAllByType(View);
      const coloredDot = allViews.find(
        (v: any) =>
          [v.props.style].flat().some(
            (s: any) => s && s.backgroundColor && s.backgroundColor !== 'transparent' && s.backgroundColor !== '#fff' && s.width === 8,
          ),
      );
      expect(coloredDot).toBeUndefined();
    });

    it('renders medium-priority dot (#f59e0b) when priority="medium"', () => {
      const task = { ...baseTask, priority: 'medium' };
      const { UNSAFE_getAllByType } = render(
        <TaskCard task={task} onToggle={noop} onDelete={noop} onPress={noop} />,
      );
      const { View } = require('react-native');
      const allViews = UNSAFE_getAllByType(View);
      const dotView = allViews.find(
        (v: any) =>
          [v.props.style].flat().some(
            (s: any) => s && s.backgroundColor === '#f59e0b',
          ),
      );
      expect(dotView).toBeTruthy();
    });
  });

  describe('accessibilityState', () => {
    it('sets accessibilityState.busy=true when pending=true', () => {
      const { getByLabelText } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} pending />,
      );
      const row = getByLabelText('Buy groceries');
      expect(row.props.accessibilityState?.busy).toBe(true);
    });

    it('sets accessibilityState.busy=false when pending=false', () => {
      const { getByLabelText } = render(
        <TaskCard task={baseTask} onToggle={noop} onDelete={noop} onPress={noop} pending={false} />,
      );
      const row = getByLabelText('Buy groceries');
      expect(row.props.accessibilityState?.busy).toBe(false);
    });
  });
});
