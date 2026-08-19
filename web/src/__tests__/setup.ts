import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'

// Global test hygiene: some suites enable fake timers (vi.useFakeTimers) and a
// few RTL suites flip document.documentElement dir/lang to rtl/ar. If either
// leaks past a test — or across files sharing a jsdom document in the same
// worker — later tests inherit a dirty environment: userEvent (which relies on
// real timers) silently stops registering input, and RTL direction changes
// query/selection behavior. This broke coverage-boost-3's TaskDetailPanel
// inline-edit test whenever a fake-timer suite (e.g. coverage-calendar) or an
// RTL suite (e.g. pages) ran before it. Reset both after every test so no test
// can inherit leaked timer or direction state, keeping the suite order-independent.
afterEach(() => {
  vi.useRealTimers()
  document.documentElement.setAttribute('dir', 'ltr')
  document.documentElement.setAttribute('lang', 'en')
})
