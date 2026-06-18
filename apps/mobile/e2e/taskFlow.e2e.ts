/**
 * Purpose: Detox e2e spec — create → list → complete task critical flow.
 * Inputs:  iOS/Android simulator running the ntask mobile app.
 * Outputs: Detox pass/fail assertions.
 * Constraints:
 *   - Tests are .skip'd until a simulator is available in CI.
 *   - See inbox: pci-native-simulator-detox — tracks simulator provisioning.
 *   - Run manually with: pnpm e2e:ios or pnpm e2e:android (not part of ci:local).
 * SPORT: T-P3-E6-W2-S6-T01
 */
import { device, element, by, expect as detoxExpect } from "detox";

// NOTE: All tests are skipped until a simulator is available in local CI.
// See ntask/apps/mobile/.claude/inbox/pci-native-simulator-detox.md for tracking.

describe("Task critical flow", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip("creates a task and it appears in the list", async () => {
    // Navigate to task creation
    await element(by.id("btn-new-task")).tap();

    // Fill in the task title
    await element(by.id("input-task-title")).typeText("Test task from Detox");

    // Confirm creation
    await element(by.id("btn-save-task")).tap();

    // Verify task appears in the list
    await detoxExpect(element(by.text("Test task from Detox"))).toBeVisible();
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip("completes a task and it moves to the done section", async () => {
    // Tap the complete button on the first task
    await element(by.id("btn-complete-task")).atIndex(0).tap();

    // Verify completed section shows the task
    await detoxExpect(element(by.id("section-done"))).toBeVisible();
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip("deletes a task and removes it from the list", async () => {
    // Long-press first task to reveal delete
    await element(by.id("task-item")).atIndex(0).longPress();
    await element(by.id("btn-delete-task")).tap();

    // Confirm deletion in dialog
    await element(by.text("Delete")).tap();

    // Verify task count decreased (list may be empty)
    await detoxExpect(element(by.id("task-item")).atIndex(0)).not.toExist();
  });
});
