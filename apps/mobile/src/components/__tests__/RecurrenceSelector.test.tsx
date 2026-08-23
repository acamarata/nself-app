/**
 * Purpose: Unit tests for RecurrenceSelector (MB-3 acceptance criteria).
 * Inputs: mocked urql useQuery/useMutation; mocked @nself/ntask-core operations.
 * Outputs: jest assertions that:
 *   - "No recurrence" renders when no rule exists
 *   - existing rule frequency renders as the summary text
 *   - tapping Daily + Save calls CREATE_RECURRING_RULE with correct variables
 *   - tapping Remove when a rule exists calls DELETE_RECURRING_RULE
 * Constraints: Runs under jest-expo preset; react-i18next and useTheme stubbed.
 * SPORT: MB-3
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// ── ntask-core: expose operation strings so useMutation mock can dispatch ────
jest.mock('@nself/ntask-core', () => ({
  GET_RECURRING_RULES: 'GET_RECURRING_RULES',
  CREATE_RECURRING_RULE: 'CREATE_RECURRING_RULE',
  UPDATE_RECURRING_RULE: 'UPDATE_RECURRING_RULE',
  DELETE_RECURRING_RULE: 'DELETE_RECURRING_RULE',
}));

// ── urql mocks ────────────────────────────────────────────────────────────────
const mockExecCreate = jest.fn().mockResolvedValue({ data: {}, error: undefined });
const mockExecUpdate = jest.fn().mockResolvedValue({ data: {}, error: undefined });
const mockExecDelete = jest.fn().mockResolvedValue({ data: {}, error: undefined });
const mockRefetch = jest.fn();

// useQuery returns are controlled per-test via mockUseQueryReturn
let mockUseQueryReturn: [object, jest.Mock] = [
  { data: null, fetching: false, error: undefined },
  mockRefetch,
];

jest.mock('urql', () => ({
  useQuery: jest.fn(() => mockUseQueryReturn),
  // Dispatch the correct executor based on the document string
  useMutation: jest.fn((doc: string) => {
    if (doc === 'CREATE_RECURRING_RULE') return [{ fetching: false }, mockExecCreate];
    if (doc === 'UPDATE_RECURRING_RULE') return [{ fetching: false }, mockExecUpdate];
    if (doc === 'DELETE_RECURRING_RULE') return [{ fetching: false }, mockExecDelete];
    return [{ fetching: false }, jest.fn()];
  }),
}));

// ── react-i18next stub ────────────────────────────────────────────────────────
const LABELS: Record<string, string> = {
  'screens:taskDetail.recurrence.label': 'Recurrence',
  'screens:taskDetail.recurrence.none': 'No recurrence',
  'screens:taskDetail.recurrence.daily': 'Daily',
  'screens:taskDetail.recurrence.weekly': 'Weekly',
  'screens:taskDetail.recurrence.monthly': 'Monthly',
  'screens:taskDetail.recurrence.yearly': 'Yearly',
  'screens:taskDetail.recurrence.every': 'Every',
  'screens:taskDetail.recurrence.interval': 'Every {{n}} {{unit}}',
  'screens:taskDetail.recurrence.save': 'Save',
  'screens:taskDetail.recurrence.remove': 'Remove',
  'screens:taskDetail.recurrence.cancel': 'Cancel',
};
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => LABELS[key] ?? key,
    i18n: { changeLanguage: jest.fn() },
  }),
}));

// ── theme stub ────────────────────────────────────────────────────────────────
jest.mock('../../theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6366F1',
      text: '#111827',
      textSecondary: '#4B5563',
      textTertiary: '#9CA3AF',
      textOnPrimary: '#FFFFFF',
      surface: '#F9FAFB',
      surfaceElevated: '#FFFFFF',
      border: '#E5E7EB',
      danger: '#EF4444',
    },
  }),
}));

import { RecurrenceSelector } from '../RecurrenceSelector';

const TASK_ID = 'task-uuid-001';

const DAILY_RULE = {
  id: 'rule-uuid-001',
  todo_id: TASK_ID,
  frequency: 'daily',
  interval_count: 1,
  by_day: null,
  by_month_day: null,
  by_month: null,
  until_date: null,
  count_limit: null,
  rrule: null,
  start_date: null,
  end_date: null,
  source_account_id: 'primary',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

function renderSelector() {
  return render(<RecurrenceSelector todoId={TASK_ID} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQueryReturn = [{ data: null, fetching: false, error: undefined }, mockRefetch];
});

describe('RecurrenceSelector', () => {
  describe('with no existing rule', () => {
    it('renders "No recurrence" as the summary', () => {
      const { getByText } = renderSelector();
      expect(getByText('No recurrence')).toBeTruthy();
    });

    it('renders the section heading', () => {
      const { getByText } = renderSelector();
      expect(getByText('Recurrence')).toBeTruthy();
    });

    it('has an accessible summary row button', () => {
      const { getByLabelText } = renderSelector();
      expect(getByLabelText('Recurrence')).toBeTruthy();
    });
  });

  describe('with an existing daily rule', () => {
    beforeEach(() => {
      mockUseQueryReturn = [
        { data: { np_recurring_rules: [DAILY_RULE] }, fetching: false, error: undefined },
        mockRefetch,
      ];
    });

    it('renders the existing frequency as the summary text', () => {
      const { getByText } = renderSelector();
      // interval_count=1 → just the frequency label, not the interval template
      expect(getByText('Daily')).toBeTruthy();
    });

    it('pre-selects Daily in the modal when opened', async () => {
      const { getByLabelText } = renderSelector();
      fireEvent.press(getByLabelText('Recurrence'));
      await waitFor(() => {
        const dailyRadio = getByLabelText('Daily');
        // The selected radio has accessibilityState.selected = true
        expect(dailyRadio.props.accessibilityState).toEqual({ selected: true });
      });
    });
  });

  describe('setting a recurrence from none', () => {
    it('calls CREATE_RECURRING_RULE with todoId and daily frequency on Save', async () => {
      const { getByLabelText } = renderSelector();

      // Open modal
      fireEvent.press(getByLabelText('Recurrence'));

      await waitFor(() => getByLabelText('Daily'));

      // Select Daily
      fireEvent.press(getByLabelText('Daily'));

      // Press Save
      await act(async () => {
        fireEvent.press(getByLabelText('Save'));
      });

      expect(mockExecCreate).toHaveBeenCalledTimes(1);
      expect(mockExecCreate).toHaveBeenCalledWith({
        todoId: TASK_ID,
        frequency: 'daily',
        intervalCount: 1,
      });
      expect(mockExecUpdate).not.toHaveBeenCalled();
      expect(mockExecDelete).not.toHaveBeenCalled();
    });
  });

  describe('clearing an existing rule', () => {
    beforeEach(() => {
      mockUseQueryReturn = [
        { data: { np_recurring_rules: [DAILY_RULE] }, fetching: false, error: undefined },
        mockRefetch,
      ];
    });

    it('calls DELETE_RECURRING_RULE with the rule id when Remove is pressed', async () => {
      const { getByLabelText } = renderSelector();

      // Open modal (pre-selects Daily)
      fireEvent.press(getByLabelText('Recurrence'));

      await waitFor(() => getByLabelText('Remove'));

      await act(async () => {
        fireEvent.press(getByLabelText('Remove'));
      });

      expect(mockExecDelete).toHaveBeenCalledTimes(1);
      expect(mockExecDelete).toHaveBeenCalledWith({ id: DAILY_RULE.id });
      expect(mockExecCreate).not.toHaveBeenCalled();
      expect(mockExecUpdate).not.toHaveBeenCalled();
    });

    it('calls DELETE_RECURRING_RULE when frequency is set to none and Save is pressed', async () => {
      const { getByLabelText } = renderSelector();

      fireEvent.press(getByLabelText('Recurrence'));
      await waitFor(() => getByLabelText('No recurrence'));

      // Switch to none
      fireEvent.press(getByLabelText('No recurrence'));

      await act(async () => {
        fireEvent.press(getByLabelText('Save'));
      });

      expect(mockExecDelete).toHaveBeenCalledTimes(1);
      expect(mockExecDelete).toHaveBeenCalledWith({ id: DAILY_RULE.id });
    });
  });

  describe('interval summary', () => {
    it('renders the interval template when interval_count > 1', () => {
      mockUseQueryReturn = [
        {
          data: { np_recurring_rules: [{ ...DAILY_RULE, interval_count: 3 }] },
          fetching: false,
          error: undefined,
        },
        mockRefetch,
      ];
      const { getByText } = renderSelector();
      // buildSummary replaces {{n}}=3 and {{unit}}=days
      expect(getByText('Every 3 days')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('all frequency options have accessibilityRole radio', async () => {
      const { getByLabelText } = renderSelector();
      fireEvent.press(getByLabelText('Recurrence'));

      await waitFor(() => {
        const dailyEl = getByLabelText('Daily');
        expect(dailyEl.props.accessibilityRole).toBe('radio');
      });
    });

    it('Save button has accessibilityRole button', async () => {
      const { getByLabelText } = renderSelector();
      fireEvent.press(getByLabelText('Recurrence'));
      await waitFor(() => {
        const saveBtn = getByLabelText('Save');
        expect(saveBtn.props.accessibilityRole).toBe('button');
      });
    });
  });
});
