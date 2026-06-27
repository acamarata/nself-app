/**
 * Purpose: SubtaskList renders without crash.
 * SPORT: P5-C-mobile.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('urql', () => ({
  useQuery: () => [{ data: { np_subtasks: [] }, fetching: false, error: null }, jest.fn()],
  useMutation: () => [{ fetching: false }, jest.fn()],
}));

import { SubtaskList } from '../SubtaskList';

describe('SubtaskList', () => {
  it('renders empty state', () => {
    const { getByText } = render(<SubtaskList todoId="test-id" />);
    expect(getByText('No subtasks yet.')).toBeTruthy();
  });
});
