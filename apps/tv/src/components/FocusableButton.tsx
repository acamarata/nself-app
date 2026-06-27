/**
 * Purpose: Large focusable button component for TV remote interaction.
 * Inputs: label, onSelect, variant (primary|secondary|danger), disabled, id (focus id)
 * Outputs: Pressable button styled for 10-foot UI with focus ring via TVFocusable.
 * Constraints:
 *   - Minimum height: 80px (10-foot UX); text ≥ 40px (body scale).
 *   - Variants: primary (brand bg), secondary (surface bg + border), danger (error color).
 *   - Loading state shows a text indicator (no spinner — TV UX prefers text feedback).
 * SPORT: Epic F — TV scaffold.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { TVFocusable, type TVFocusableProps } from '../navigation/FocusContext';
import { tvTheme } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface FocusableButtonProps extends Pick<TVFocusableProps, 'nextFocusUp' | 'nextFocusDown' | 'nextFocusLeft' | 'nextFocusRight'> {
  id: string;
  label: string;
  onSelect: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

const variantStyles = {
  primary: {
    backgroundColor: tvTheme.colors.brand,
    borderColor: 'transparent',
  },
  secondary: {
    backgroundColor: tvTheme.colors.surface,
    borderColor: tvTheme.colors.border,
  },
  danger: {
    backgroundColor: tvTheme.colors.error,
    borderColor: 'transparent',
  },
} as const;

export function FocusableButton({
  id,
  label,
  onSelect,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
}: FocusableButtonProps) {
  return (
    <TVFocusable
      id={id}
      onSelect={disabled || loading ? undefined : onSelect}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      style={[
        styles.button,
        variantStyles[variant],
        (disabled || loading) ? styles.disabled : null,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={tvTheme.colors.textPrimary} size="small" />
        ) : (
          <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>
            {label}
          </Text>
        )}
      </View>
    </TVFocusable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 80,
    paddingHorizontal: tvTheme.spacing.xl,
    borderRadius: tvTheme.radius.md,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tvTheme.spacing.sm,
  },
  label: {
    fontSize: tvTheme.typeScale.body,
    fontWeight: '600',
    color: tvTheme.colors.textPrimary,
  },
  labelSecondary: {
    color: tvTheme.colors.textSecondary,
  },
  disabled: {
    opacity: 0.4,
  },
});
