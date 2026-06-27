/**
 * Purpose: Unit tests for AddTaskModal — title, offline label, save/cancel actions, validation, input reset.
 * Inputs: mocked taskCreateSchema; controlled props.
 * Outputs: jest assertions on rendered UI, callbacks, and validation error display.
 * Constraints: Runs under jest-expo preset; no real network or native modules.
 * SPORT: P5-C-add-task-modal
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../lib/validation', () => ({
  taskCreateSchema: jest.fn((input: any) => {
    if (!input.title || input.title.trim() === '') {
      return { success: false, errors: [{ field: 'title', message: 'Title is required' }], data: null };
    }
    return { success: true, data: { title: input.title.trim(), listId: input.listId }, errors: [] };
  }),
}));

import { AddTaskModal } from '../AddTaskModal';

const DEFAULT_PROPS = {
  visible: true,
  listId: 'list-1',
  isOffline: false,
  onSave: jest.fn(),
  onClose: jest.fn(),
};

function renderModal(props: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<AddTaskModal {...DEFAULT_PROPS} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AddTaskModal', () => {
  describe('rendering', () => {
    it('renders "New task" title', () => {
      const { getByText } = renderModal();
      expect(getByText('New task')).toBeTruthy();
    });

    it('renders the Task title input', () => {
      const { getByLabelText } = renderModal();
      expect(getByLabelText('Task title')).toBeTruthy();
    });

    it('renders "Save task" button label when isOffline=false', () => {
      const { getByLabelText } = renderModal({ isOffline: false });
      expect(getByLabelText('Save task')).toBeTruthy();
    });

    it('renders "Save task (queued for offline sync)" button label when isOffline=true', () => {
      const { getByLabelText } = renderModal({ isOffline: true });
      expect(getByLabelText('Save task (queued for offline sync)')).toBeTruthy();
    });

    it('renders "Save (offline)" visible text when isOffline=true', () => {
      const { getByText } = renderModal({ isOffline: true });
      expect(getByText('Save (offline)')).toBeTruthy();
    });

    it('renders Cancel button', () => {
      const { getByLabelText } = renderModal();
      expect(getByLabelText('Cancel')).toBeTruthy();
    });
  });

  describe('save action', () => {
    it('typing a title and pressing Save calls onSave with the trimmed title', () => {
      const onSave = jest.fn();
      const { getByLabelText } = renderModal({ onSave });
      const input = getByLabelText('Task title');
      fireEvent.changeText(input, 'Buy milk');
      const saveBtn = getByLabelText('Save task');
      fireEvent.press(saveBtn);
      expect(onSave).toHaveBeenCalledWith('Buy milk');
    });

    it('pressing Save with an empty title does not call onSave', () => {
      const onSave = jest.fn();
      const { getByLabelText } = renderModal({ onSave });
      const saveBtn = getByLabelText('Save task');
      fireEvent.press(saveBtn);
      expect(onSave).not.toHaveBeenCalled();
    });

    it('pressing Save with an empty title shows validation error "Title is required"', () => {
      const { getByLabelText, getByText } = renderModal();
      fireEvent.press(getByLabelText('Save task'));
      expect(getByText('Title is required')).toBeTruthy();
    });

    it('clears the input after a successful save', () => {
      const onSave = jest.fn();
      const { getByLabelText } = renderModal({ onSave });
      const input = getByLabelText('Task title');
      fireEvent.changeText(input, 'Write report');
      fireEvent.press(getByLabelText('Save task'));
      // After save, title state resets to '' — input value should be empty
      expect(input.props.value).toBe('');
    });

    it('clears validation error when user starts typing after a failed save', () => {
      const { getByLabelText, queryByText } = renderModal();
      // Trigger validation error
      fireEvent.press(getByLabelText('Save task'));
      // Then type to clear error
      const input = getByLabelText('Task title');
      fireEvent.changeText(input, 'A');
      expect(queryByText('Title is required')).toBeNull();
    });
  });

  describe('cancel action', () => {
    it('pressing Cancel calls onClose', () => {
      const onClose = jest.fn();
      const { getByLabelText } = renderModal({ onClose });
      fireEvent.press(getByLabelText('Cancel'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('pressing Cancel clears the input', () => {
      const onClose = jest.fn();
      const { getByLabelText } = renderModal({ onClose });
      const input = getByLabelText('Task title');
      fireEvent.changeText(input, 'Some text');
      fireEvent.press(getByLabelText('Cancel'));
      expect(input.props.value).toBe('');
    });
  });

  describe('offline label', () => {
    it('Save button accessible label differs between online and offline', () => {
      const { getByLabelText: online } = renderModal({ isOffline: false });
      expect(online('Save task')).toBeTruthy();

      const { getByLabelText: offline } = renderModal({ isOffline: true });
      expect(offline('Save task (queued for offline sync)')).toBeTruthy();
    });
  });
});
