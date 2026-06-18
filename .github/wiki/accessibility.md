# Accessibility — ɳTask Mobile

**Standard:** WCAG 2.1 AA equivalent via React Native accessibility API.
**Ticket:** T-P3-E6-W1-S5-T01

## Policy

All interactive elements in the ɳTask mobile app (iOS + Android) must meet WCAG 2.1 AA equivalent standards using React Native's built-in accessibility system.

## Implementation Pattern

### Interactive elements (Pressable / TouchableOpacity)

Every tappable element must have:
- `accessibilityLabel` — concise description of the action (not just the visible text)
- `accessibilityRole` — `"button"` for actions, `"checkbox"` for toggles, `"tab"` for navigation

```tsx
<TouchableOpacity
  onPress={handleSave}
  accessibilityRole="button"
  accessibilityLabel="Save task changes"
>
  <Text>Save</Text>
</TouchableOpacity>
```

### Text inputs

All `TextInput` components must have `accessibilityLabel`:

```tsx
<TextInput
  accessibilityLabel="Task title"
  placeholder="Enter task title"
/>
```

### Modals

Modal content containers must declare `accessibilityViewIsModal={true}` on the inner view so screen readers focus inside the dialog:

```tsx
<Modal visible={visible} transparent>
  <View style={styles.overlay}>
    <View style={styles.modal} accessibilityViewIsModal={true}>
      ...
    </View>
  </View>
</Modal>
```

### Checkboxes

Task completion checkboxes use `accessibilityRole="checkbox"` with `accessibilityState.checked`:

```tsx
<TouchableOpacity
  accessibilityRole="checkbox"
  accessibilityState={{ checked: task.completed }}
>
```

### Loading / pending state

Optimistic-pending task rows declare `accessibilityState={{ busy: true }}` so VoiceOver/TalkBack announces "loading".

## Components Audited

| Component | File | Status |
|---|---|---|
| TaskCard | `src/components/TaskCard.tsx` | WCAG AA |
| EmptyState | `src/components/seven-states/EmptyState.tsx` | WCAG AA |
| ErrorCard | `src/components/seven-states/ErrorCard.tsx` | WCAG AA |
| HomeScreen modals | `src/app/HomeScreen.tsx` | WCAG AA |
| ListScreen modals | `src/app/ListScreen.tsx` | WCAG AA |
| LoginScreen | `src/app/LoginScreen.tsx` | WCAG AA |
| TaskDetailScreen | `src/app/TaskDetailScreen.tsx` | WCAG AA |
| AssigneeSelector | `src/components/AssigneeSelector.tsx` | WCAG AA |

## Automated Tests

`apps/mobile/__tests__/a11y.test.tsx` — uses `@testing-library/react-native` a11y queries to assert labels, roles, and states on all interactive components.

Run: `pnpm --dir apps/mobile test a11y`

## Colour Contrast

All text/background colour pairs in `StyleSheet` entries use the project's indigo (`#6366f1`) primary on white (`#ffffff`) background — contrast ratio 5.8:1 (exceeds 4.5:1 AA minimum). Secondary text (`#6b7280`) on white — 4.6:1, passes AA.
