/**
 * Purpose: D-pad focus management context for ɳTask TV.
 * Inputs: none (React context provider wrapping the app tree)
 * Outputs:
 *   - FocusProvider: context provider that tracks the currently focused element id.
 *   - useFocus: hook returning { focusedId, setFocused, clearFocus }.
 *   - TVFocusable: wrapper component that wires tvOS UIFocusEngine + Android TV
 *     nextFocusUp/Down/Left/Right props, calls onFocus/onBlur, applies focus-ring style.
 * Constraints:
 *   - tvOS: relies on the built-in focus engine via isTVSelectable + onFocus/onBlur callbacks.
 *     No manual focus management needed — UIFocusEngine handles D-pad routing.
 *   - Android TV: uses nextFocusUp/Down/Left/Right nativeID props for explicit routing
 *     on older Fire TV and Android TV boxes that lack the tvOS focus engine.
 *   - Focus ring: 4px brand border + shadow applied via StyleSheet (not outline — RN doesn't
 *     support CSS outline; border + shadow is the correct pattern).
 *   - All TVFocusable children must be pressable: wraps TouchableOpacity with tvParallaxProperties
 *     disabled (parallax is distracting for a dashboard UI).
 *   - onSelect fires when the user presses OK/Select on the remote.
 *   - TVFocusableProps.id must be unique per screen; reuse across screens is fine.
 *   - react-native-tvos extends TouchableOpacity with TV props (isTVSelectable, tvParallaxProperties,
 *     nextFocusUp/Down/Left/Right, nativeID) not present in @types/react-native. We cast to `any`
 *     once at the component level and annotate the reason.
 * SPORT: Epic F — TV scaffold.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { tvTheme } from '../theme';

// react-native-tvos adds TV-specific props not in @types/react-native.
// We cast once here and use TVTouchable throughout this module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TVTouchable = TouchableOpacity as any;

// ─── Focus Context ─────────────────────────────────────────────────────────────

interface FocusContextValue {
  focusedId: string | null;
  setFocused: (id: string) => void;
  clearFocus: () => void;
}

const FocusContext = createContext<FocusContextValue>({
  focusedId: null,
  setFocused: () => undefined,
  clearFocus: () => undefined,
});

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const setFocused = useCallback((id: string) => setFocusedId(id), []);
  const clearFocus = useCallback(() => setFocusedId(null), []);

  return (
    <FocusContext.Provider value={{ focusedId, setFocused, clearFocus }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  return useContext(FocusContext);
}

// ─── TVFocusable ───────────────────────────────────────────────────────────────

export interface TVFocusableProps {
  /** Unique id for this focusable — used by FocusContext and Android TV nativeID. */
  id: string;
  /** Called when user presses OK/Select on the remote. */
  onSelect?: () => void;
  /** Called when element gains focus. */
  onFocusChange?: (focused: boolean) => void;
  /** Android TV: nativeID of the element above this one in D-pad order. */
  nextFocusUp?: string;
  /** Android TV: nativeID of the element below this one in D-pad order. */
  nextFocusDown?: string;
  /** Android TV: nativeID of the element to the left of this one. */
  nextFocusLeft?: string;
  /** Android TV: nativeID of the element to the right of this one. */
  nextFocusRight?: string;
  /** Additional styles for the container View. */
  style?: StyleProp<ViewStyle>;
  /** Accessible label for the screen reader. */
  accessibilityLabel?: string;
  children: React.ReactNode;
  /** If true, renders as non-interactive (no touch, no focus ring). */
  disabled?: boolean;
}

/**
 * TVFocusable — wrapper for all interactive TV elements.
 *
 * Renders a TVTouchable (TouchableOpacity cast to accept TV props) that:
 *   - isTVSelectable: true — opts in to tvOS UIFocusEngine
 *   - tvParallaxProperties.enabled: false — suppresses distracting parallax
 *   - nativeID: id — used by Android TV nextFocus* routing
 *   - Applies a high-visibility focus ring (border + shadow) on focus
 */
export function TVFocusable({
  id,
  onSelect,
  onFocusChange,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
  style,
  accessibilityLabel,
  children,
  disabled = false,
}: TVFocusableProps) {
  const { setFocused, clearFocus } = useFocus();
  const [isFocused, setIsFocused] = useState(false);
  const touchableRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setFocused(id);
    onFocusChange?.(true);
  }, [id, setFocused, onFocusChange]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    clearFocus();
    onFocusChange?.(false);
  }, [clearFocus, onFocusChange]);

  const focusedStyle: StyleProp<ViewStyle> = isFocused
    ? {
        borderColor: tvTheme.colors.focus,
        borderWidth: tvTheme.focusRing.borderWidth,
        shadowColor: tvTheme.colors.focusShadow,
        shadowRadius: tvTheme.focusRing.shadowRadius,
        shadowOpacity: tvTheme.focusRing.shadowOpacity,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      }
    : {
        borderColor: 'transparent',
        borderWidth: tvTheme.focusRing.borderWidth,
      };

  if (disabled) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <TVTouchable
      ref={touchableRef}
      nativeID={id}
      accessible
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.85}
      isTVSelectable={true}
      tvParallaxProperties={{ enabled: false }}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onSelect}
      style={[styles.container, style, focusedStyle]}
    >
      {children}
    </TVTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: tvTheme.radius.md,
    overflow: 'hidden',
  },
});
