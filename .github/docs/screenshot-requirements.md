# ɳTasks Screenshot Requirements

## Required Screenshots

Both Apple App Store and Google Play require screenshots for listing approval.

### iOS (App Store Connect)

| Device | Resolution | Required |
|--------|-----------|----------|
| iPhone 6.7" (15 Pro Max) | 1290 x 2796 | Yes |
| iPhone 6.5" (14 Plus) | 1284 x 2778 | Yes |
| iPad Pro 12.9" | 2048 x 2732 | If supporting iPad |

Minimum 3 screenshots per device class. Maximum 10.

### Android (Google Play Console)

| Type | Resolution | Required |
|------|-----------|----------|
| Phone | 1080 x 1920 min | Yes (2-8 screenshots) |
| Tablet 7" | 1080 x 1920 | If supporting tablets |
| Tablet 10" | 1920 x 1200 | If supporting tablets |

### Scenes to Capture

1. **Task list** - Main screen with several tasks showing different states (completed, pending, overdue)
2. **Task creation/edit** - The form with title, description, due date, priority
3. **Shared tasks** - View showing tasks shared between users
4. **Dark mode** - Same task list in dark theme
5. **Settings** - Backend connection and preferences screen
6. **Empty state** - First-launch experience before any tasks exist

### How to Capture

Flutter was eliminated (ASI Policy 2) and `app/` no longer exists; the former
`flutter test integration_test/...` recipe cannot run. Capture from the React
Native surface instead:

```bash
cd apps/mobile
pnpm start            # then press i (iOS) or a (Android)
```

Or manually via the simulator:
- iOS: `xcrun simctl io booted screenshot screenshot.png`
- Android: `adb exec-out screencap -p > screenshot.png`

### Framing

Use a tool like `fastlane frameit` or `screenshots` package to add device frames and captions. Captions should be short and benefit-focused:

1. "Your tasks. Your server."
2. "Organize with priorities and due dates"
3. "Share tasks with your team"
4. "Works in dark mode too"
5. "Connect to any nSelf backend"
