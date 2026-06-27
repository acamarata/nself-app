// tray.rs — System tray icon for ɳTask desktop.
// Purpose: 3-state tray icon (connected/syncing/offline) with context menu.
//          macOS: pure-black template icon, left-click shows context menu.
//          Windows/Linux: coloured icon, left-click shows/focuses main window.
// Inputs:  app: &mut tauri::App (called once in lib.rs setup closure).
// Outputs: Registered TrayIcon — owned by Tauri runtime for the app lifetime.
// Constraints: Tray icons must exist as bundled resources in tauri.conf.json.
// SPORT: F08-SERVICE-INVENTORY — desktop-tray

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

/// Fixed tray icon ID so set_tray_status can look it up via app.tray_by_id().
pub const TRAY_ID: &str = "ntask-tray";

pub fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItemBuilder::with_id("open", "Open ɳTask").build(app)?;
    let sync = MenuItemBuilder::with_id("sync", "Sync Now").build(app)?;
    let prefs = MenuItemBuilder::with_id("prefs", "Preferences…").build(app)?;
    let login = MenuItemBuilder::with_id("login", "Launch at Login").build(app)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit ɳTask").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&open, &sep1, &sync, &prefs, &sep2, &login, &sep3, &quit])
        .build()?;

    TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("ɳTask")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "sync" => {
                // Emit to frontend — useTrayStatus.ts / useSyncStatus.ts listens.
                let _ = app.emit("tray://sync-now", ());
            }
            "prefs" => {
                // Open settings window if registered.
                if let Some(win) = app.get_webview_window("settings") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "login" => {
                // Toggle autostart — frontend settings hook handles the actual toggle via IPC.
                let _ = app.emit("tray://toggle-launch-at-login", ());
            }
            "quit" => {
                app.exit(0);
            }
            other => {
                tracing::debug!("Unhandled tray menu event: {}", other);
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Windows/Linux: left-click shows main window (macOS handles click via menu binding).
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
