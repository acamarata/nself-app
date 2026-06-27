// menu.rs — Native menu bar for ɳTask desktop.
// Purpose: Build the OS-native menu bar. macOS gets a full app menu; Windows
//          and Linux get a subset. Menu items emit Tauri events or invoke Rust
//          operations; the SPA listens for events via @nself/tauri-bridge.
// Inputs:  app: &mut tauri::App (passed from lib.rs setup closure).
// Outputs: tauri::menu::Menu — set on the app in lib.rs via app.set_menu().
// Constraints: Use PredefinedMenuItem for standard OS accelerators (Cut/Copy/
//              Paste, etc.) — do not re-implement them manually.
// SPORT: no new entries (menu is UI surface, not a tracked service).

use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager,
};

/// Build the full native menu bar. Called from lib.rs setup closure with
/// `app: &mut tauri::App`. Menu is then set via `app.set_menu(menu)`.
pub fn build_app_menu<R: tauri::Runtime>(app: &impl tauri::Manager<R>) -> tauri::Result<Menu<R>> {
    // ── ɳTask (macOS app menu) ────────────────────────────────────────────
    let about = PredefinedMenuItem::about(app, Some("About ɳTask"), None)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let hide = PredefinedMenuItem::hide(app, Some("Hide ɳTask"))?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit ɳTask"))?;
    let prefs = MenuItemBuilder::with_id("prefs", "Preferences…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let app_submenu = SubmenuBuilder::new(app, "ɳTask")
        .items(&[&about, &separator, &prefs, &separator, &hide, &separator, &quit])
        .build()?;

    // ── File ──────────────────────────────────────────────────────────────
    let new_task = MenuItemBuilder::with_id("new-task", "New Task")
        .accelerator("CmdOrCtrl+T")
        .build(app)?;
    let export_csv = MenuItemBuilder::with_id("export-csv", "Export as CSV…").build(app)?;
    let export_json = MenuItemBuilder::with_id("export-json", "Export as JSON…").build(app)?;
    let import_json = MenuItemBuilder::with_id("import-json", "Import from JSON…").build(app)?;
    let close_window = PredefinedMenuItem::close_window(app, Some("Close Window"))?;

    let sep_file = PredefinedMenuItem::separator(app)?;
    let sep_file2 = PredefinedMenuItem::separator(app)?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .items(&[
            &new_task,
            &sep_file,
            &export_csv,
            &export_json,
            &import_json,
            &sep_file2,
            &close_window,
        ])
        .build()?;

    // ── Edit ──────────────────────────────────────────────────────────────
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let sep_edit = PredefinedMenuItem::separator(app)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .items(&[&undo, &redo, &sep_edit, &cut, &copy, &paste, &select_all])
        .build()?;

    // ── View ──────────────────────────────────────────────────────────────
    let reload = MenuItemBuilder::with_id("reload", "Reload")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let devtools = MenuItemBuilder::with_id("devtools", "Toggle Developer Tools")
        .accelerator("F12")
        .build(app)?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .items(&[&reload, &devtools])
        .build()?;

    // ── Window ────────────────────────────────────────────────────────────
    let minimize = PredefinedMenuItem::minimize(app, None)?;
    let maximize = PredefinedMenuItem::maximize(app, None)?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .items(&[&minimize, &maximize])
        .build()?;

    // ── Help ──────────────────────────────────────────────────────────────
    let docs = MenuItemBuilder::with_id("docs", "ɳTask Documentation").build(app)?;
    let report_bug = MenuItemBuilder::with_id("report-bug", "Report a Bug").build(app)?;
    let check_updates = MenuItemBuilder::with_id("check-updates", "Check for Updates…").build(app)?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .items(&[&docs, &report_bug, &check_updates])
        .build()?;

    // ── Assemble top-level menu ───────────────────────────────────────────
    let menu = MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
            &help_submenu,
        ])
        .build()?;

    Ok(menu)
}

/// Handle native menu bar events emitted from the menu items.
/// Called from lib.rs via `.on_menu_event()` registration.
/// Free function so lib.rs can pass its own closure referencing this.
pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        "prefs" => {
            if let Some(win) = app.get_webview_window("settings") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
        "new-task" => {
            let _ = app.emit("menu://new-task", ());
        }
        "export-csv" => {
            let _ = app.emit("menu://export-csv", ());
        }
        "export-json" => {
            let _ = app.emit("menu://export-json", ());
        }
        "import-json" => {
            let _ = app.emit("menu://import-json", ());
        }
        "reload" => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.eval("window.location.reload()");
            }
        }
        "devtools" => {
            if let Some(win) = app.get_webview_window("main") {
                if win.is_devtools_open() {
                    win.close_devtools();
                } else {
                    win.open_devtools();
                }
            }
        }
        "docs" => {
            let _ = app.emit("menu://open-url", "https://docs.nself.org/ntask");
        }
        "report-bug" => {
            let _ = app.emit("menu://open-url", "https://github.com/nself-org/ntask/issues");
        }
        "check-updates" => {
            let _ = app.emit("menu://check-updates", ());
        }
        other => {
            tracing::debug!("Unhandled menu event: {}", other);
        }
    }
}
