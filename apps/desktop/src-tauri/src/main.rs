// main.rs — Tauri 2 entry point for ɳTask desktop.
// Purpose: Bootstraps the Tauri 2 runtime via the library crate.
// Inputs:  None directly — tauri.conf.json drives configuration.
// Outputs: Running ɳTask desktop application.
// Constraints: No business logic here; all logic delegated to lib.rs.
// SPORT: F12-REPO-TYPE-MAP — ntask/apps/desktop sub-surface of Type C repo.

// Prevent a console window appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ntask_desktop_lib::run();
}
