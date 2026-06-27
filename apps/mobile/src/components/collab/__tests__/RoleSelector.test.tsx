/**
 * Purpose: Unit tests for RoleSelector — role pill rendering, selection, and guard logic.
 * Constraints: No external deps; all logic is pure UI + callback.
 * SPORT: P5-L-collab-ops
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RoleSelector } from '../RoleSelector';

describe('RoleSelector', () => {
  describe('selectable roles', () => {
    it('renders Admin, Editor, and Viewer pills', () => {
      const { getByText } = render(
        <RoleSelector currentRole="viewer" onSelect={jest.fn()} />,
      );
      expect(getByText('Admin')).toBeTruthy();
      expect(getByText('Editor')).toBeTruthy();
      expect(getByText('Viewer')).toBeTruthy();
    });

    it('does NOT render Owner as a selectable pill when currentRole is not owner', () => {
      const { queryByText } = render(
        <RoleSelector currentRole="editor" onSelect={jest.fn()} />,
      );
      expect(queryByText('Owner')).toBeNull();
    });

    it('selected role pill has accessibilityState selected=true', () => {
      const { getByRole, getAllByRole } = render(
        <RoleSelector currentRole="editor" onSelect={jest.fn()} />,
      );
      const pills = getAllByRole('radio');
      const editorPill = pills.find(
        (p) => p.props.accessibilityLabel === 'Editor role',
      );
      expect(editorPill).toBeTruthy();
      expect(editorPill?.props.accessibilityState?.selected).toBe(true);
    });

    it('non-selected role pills have accessibilityState selected=false', () => {
      const { getAllByRole } = render(
        <RoleSelector currentRole="editor" onSelect={jest.fn()} />,
      );
      const pills = getAllByRole('radio');
      const adminPill = pills.find(
        (p) => p.props.accessibilityLabel === 'Admin role',
      );
      expect(adminPill?.props.accessibilityState?.selected).toBe(false);
    });
  });

  describe('onSelect callback', () => {
    it('calls onSelect with the correct role string when a pill is tapped', () => {
      const onSelect = jest.fn();
      const { getByText } = render(
        <RoleSelector currentRole="viewer" onSelect={onSelect} />,
      );
      fireEvent.press(getByText('Admin'));
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('admin');
    });

    it('calls onSelect with editor when Editor pill is tapped', () => {
      const onSelect = jest.fn();
      const { getByText } = render(
        <RoleSelector currentRole="admin" onSelect={onSelect} />,
      );
      fireEvent.press(getByText('Editor'));
      expect(onSelect).toHaveBeenCalledWith('editor');
    });
  });

  describe('disabled prop', () => {
    it('does not call onSelect when disabled is true', () => {
      const onSelect = jest.fn();
      const { getByText } = render(
        <RoleSelector currentRole="viewer" onSelect={onSelect} disabled />,
      );
      fireEvent.press(getByText('Admin'));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('marks pills as disabled in accessibilityState when disabled=true', () => {
      const { getAllByRole } = render(
        <RoleSelector currentRole="viewer" onSelect={jest.fn()} disabled />,
      );
      const pills = getAllByRole('radio');
      pills.forEach((pill) => {
        expect(pill.props.accessibilityState?.disabled).toBe(true);
      });
    });
  });

  describe('owner display', () => {
    it('renders only the Owner display pill when currentRole is owner', () => {
      const { getByText, queryByRole } = render(
        <RoleSelector currentRole="owner" onSelect={jest.fn()} />,
      );
      expect(getByText('Owner')).toBeTruthy();
      // No interactive radio buttons — owner is display-only
      expect(queryByRole('radio')).toBeNull();
    });
  });
});
