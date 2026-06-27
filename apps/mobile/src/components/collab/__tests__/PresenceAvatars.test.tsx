/**
 * Purpose: Unit tests for PresenceAvatars — avatar count, overflow, status styling, empty state.
 * Constraints: No external deps; pure rendering.
 * SPORT: P5-L-collab-ops
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { PresenceAvatars } from '../PresenceAvatars';

const makeUser = (
  userId: string,
  displayName: string,
  status: 'viewing' | 'editing' = 'viewing',
) => ({ userId, displayName, avatarUrl: null, status });

describe('PresenceAvatars', () => {
  describe('empty state', () => {
    it('renders nothing when presenceUsers is empty', () => {
      const { toJSON } = render(<PresenceAvatars presenceUsers={[]} />);
      expect(toJSON()).toBeNull();
    });
  });

  describe('avatar count', () => {
    it('renders exactly as many initials as users when under maxVisible', () => {
      const users = [
        makeUser('u1', 'Alice Brown'),
        makeUser('u2', 'Bob Smith'),
        makeUser('u3', 'Carol Jones'),
      ];
      const { getByText } = render(<PresenceAvatars presenceUsers={users} />);
      expect(getByText('AB')).toBeTruthy();
      expect(getByText('BS')).toBeTruthy();
      expect(getByText('CJ')).toBeTruthy();
    });

    it('caps visible avatars at maxVisible (default 4)', () => {
      // Use names that produce distinct initials across positions
      const users = [
        makeUser('u0', 'Alpha Zero'),
        makeUser('u1', 'Beta One'),
        makeUser('u2', 'Gamma Two'),
        makeUser('u3', 'Delta Three'),
        makeUser('u4', 'Epsilon Four'),
        makeUser('u5', 'Zeta Five'),
      ];
      const { getByText, queryByText } = render(
        <PresenceAvatars presenceUsers={users} />,
      );
      // 4 visible avatars rendered
      expect(getByText('AZ')).toBeTruthy();
      expect(getByText('DT')).toBeTruthy();
      // 5th and 6th users must NOT appear as initials
      expect(queryByText('EF')).toBeNull();
      expect(queryByText('ZF')).toBeNull();
    });

    it('respects a custom maxVisible prop', () => {
      const users = [
        makeUser('u0', 'Alpha Zero'),
        makeUser('u1', 'Beta One'),
        makeUser('u2', 'Gamma Two'),
        makeUser('u3', 'Delta Three'),
        makeUser('u4', 'Epsilon Four'),
      ];
      const { getByText, queryByText } = render(
        <PresenceAvatars presenceUsers={users} maxVisible={2} />,
      );
      expect(getByText('AZ')).toBeTruthy();
      // Third user should not appear
      expect(queryByText('GT')).toBeNull();
    });
  });

  describe('overflow bubble', () => {
    it('shows +N overflow when more users than maxVisible', () => {
      const users = Array.from({ length: 6 }, (_, i) =>
        makeUser(`u${i}`, `Us${i} Er`),
      );
      const { getByText } = render(<PresenceAvatars presenceUsers={users} />);
      expect(getByText('+2')).toBeTruthy();
    });

    it('does not show overflow bubble when users equal maxVisible', () => {
      const users = Array.from({ length: 4 }, (_, i) =>
        makeUser(`u${i}`, `Zz${i} Xx`),
      );
      const { queryByText } = render(<PresenceAvatars presenceUsers={users} />);
      // No +N text should appear
      expect(queryByText(/^\+\d+$/)).toBeNull();
    });
  });

  describe('editing vs viewing status', () => {
    it('editing user avatar has green border styling (borderEditing)', () => {
      const users = [makeUser('u1', 'Editing User', 'editing')];
      const { getByLabelText } = render(<PresenceAvatars presenceUsers={users} />);
      const avatar = getByLabelText('Editing User is editing');
      expect(avatar.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ borderColor: '#22c55e' }),
        ]),
      );
    });

    it('viewing user avatar has gray border styling (borderViewing)', () => {
      const users = [makeUser('u2', 'Watching User', 'viewing')];
      const { getByLabelText } = render(<PresenceAvatars presenceUsers={users} />);
      const avatar = getByLabelText('Watching User is viewing');
      expect(avatar.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ borderColor: '#d1d5db' }),
        ]),
      );
    });
  });

  describe('accessibility label', () => {
    it('applies a top-level accessibilityLabel summarising all present users', () => {
      const users = [
        makeUser('u1', 'Alice Brown', 'editing'),
        makeUser('u2', 'Bob Smith', 'viewing'),
      ];
      const { getByLabelText } = render(<PresenceAvatars presenceUsers={users} />);
      expect(
        getByLabelText('Present: Alice Brown (editing), Bob Smith (viewing)'),
      ).toBeTruthy();
    });
  });
});
