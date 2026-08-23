/**
 * Purpose: ReminderList reads and writes np_reminders — the same table the web
 *   client uses — and computes preset times as offsets from the due date.
 *
 * Mobile previously had no reminders UI at all. The only reminder code was a
 * useReminders hook that scheduled a purely local notification and was never
 * called by anything, so reminders could not sync between surfaces.
 * SPORT: P5-C-mobile — reminders.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';

const DUE = '2026-03-10T17:00:00.000Z';

interface TestReminder {
  id: string;
  todo_id: string;
  remind_at: string;
  sent: boolean;
}

let mockReminders: TestReminder[] = [];
let mockError: unknown = null;
const mockRefetch = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();

jest.mock('urql', () => ({
  useQuery: () => [
    { data: { np_reminders: mockReminders }, fetching: false, error: mockError },
    (...a: unknown[]) => mockRefetch(...a),
  ],
  useMutation: (op: string) => {
    if (String(op).includes('insert_np_reminders_one')) {
      return [{}, (...a: unknown[]) => mockCreate(...a)];
    }
    return [{}, (...a: unknown[]) => mockDelete(...a)];
  },
}));

import { ReminderList } from '../ReminderList';

function renderList(dueDate: string | null = DUE) {
  return render(
    <ThemeProvider>
      <ReminderList todoId="todo-1" dueDate={dueDate} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReminders = [];
  mockError = null;
  mockCreate.mockResolvedValue({ data: {}, error: null });
  mockDelete.mockResolvedValue({ data: {}, error: null });
});

describe('ReminderList', () => {
  it('shows the empty state when there are none', () => {
    const { getByText } = renderList();
    expect(getByText('No reminders.')).toBeTruthy();
  });

  it('shows the error state when the query fails', () => {
    mockError = new Error('boom');
    const { getByText } = renderList();
    expect(getByText('Could not load reminders.')).toBeTruthy();
  });

  it('hides the presets and explains why when there is no due date', () => {
    // Every preset is an offset from the due date; offering them with nothing
    // to offset from would create a reminder at an arbitrary time.
    const { getByText, queryByLabelText } = renderList(null);
    expect(getByText('Set a due date to add reminders.')).toBeTruthy();
    expect(queryByLabelText('1 hour before')).toBeNull();
  });

  it('offers presets once a due date exists', () => {
    const { getByLabelText } = renderList();
    for (const label of ['At due time', '10 min before', '1 hour before', '1 day before']) {
      expect(getByLabelText(label)).toBeTruthy();
    }
  });

  it('creates a reminder at the due time for the zero-offset preset', async () => {
    const { getByLabelText } = renderList();
    fireEvent.press(getByLabelText('At due time'));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        todoId: 'todo-1', remindAt: DUE, channel: 'push',
      }),
    );
  });

  it('subtracts the offset from the due date for a "before" preset', async () => {
    const { getByLabelText } = renderList();
    fireEvent.press(getByLabelText('1 hour before'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const { remindAt } = mockCreate.mock.calls[0][0];
    expect(new Date(DUE).getTime() - new Date(remindAt).getTime()).toBe(60 * 60_000);
  });

  it('refetches after creating', async () => {
    const { getByLabelText } = renderList();
    fireEvent.press(getByLabelText('1 day before'));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });

  it('does not refetch when the server rejects the create', async () => {
    mockCreate.mockResolvedValueOnce({ data: null, error: new Error('denied') });
    const { getByLabelText } = renderList();
    fireEvent.press(getByLabelText('10 min before'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('marks a reminder whose time has passed instead of hiding it', () => {
    // A user who set a reminder for a time that has gone by should be able to
    // see why nothing fired.
    mockReminders = [{ id: 'r1', todo_id: 'todo-1', remind_at: '2020-01-01T00:00:00.000Z', sent: false }];
    const { getByText } = renderList();
    expect(getByText('Past')).toBeTruthy();
  });

  it('marks a reminder that was already sent', () => {
    mockReminders = [{ id: 'r1', todo_id: 'todo-1', remind_at: '2020-01-01T00:00:00.000Z', sent: true }];
    const { getByText } = renderList();
    expect(getByText('Sent')).toBeTruthy();
  });

  it('deletes by id', async () => {
    mockReminders = [{ id: 'r1', todo_id: 'todo-1', remind_at: DUE, sent: false }];
    const { getByLabelText } = renderList();
    fireEvent.press(getByLabelText(/^Remove reminder/));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ id: 'r1' }));
  });
});
