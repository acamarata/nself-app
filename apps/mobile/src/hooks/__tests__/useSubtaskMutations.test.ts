/**
 * Purpose: Smoke test for useSubtaskMutations hook exports.
 * SPORT: P5-C-mobile — co-located test.
 */

import { useSubtaskMutations, useCommentMutations, useTagMutations } from '../useTaskMutations';

describe('useSubtaskMutations', () => {
  it('exports expected mutation functions', () => {
    expect(typeof useSubtaskMutations).toBe('function');
    expect(typeof useCommentMutations).toBe('function');
    expect(typeof useTagMutations).toBe('function');
  });
});
