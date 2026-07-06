// tray.rs — System tray icon for ɳTask desktop.
// Purpose: 3-state tray icon (connected/syncing/offline) with context menu.
//          macOS: pure-black template icon, left-click shows context menu.
//          Windows/Linux: coloured icon, left-click shows/focuses main window.
// Inputs:  app: &mut tauri::App (called once in lib.rs setup closure).
// Outputs: Registered TrayIcon — owned by Tauri runtime for the app lifetime.
// Constraints: Tray icons must exist as bundled resources in tauri.conf.json.
// SPORT: F08-SERVICE-INVENTORY — desktop-tray

use crate::spa_nav::spa_navigate_js;
use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_autostart::ManagerExt;

/// Fixed tray icon ID so set_tray_status can look it up via app.tray_by_id().
pub const TRAY_ID: &str = "ntask-tray";

/// Menu item ID for the "Launch at Login" checkbox.
const LOGIN_ITEM_ID: &str = "login";

pub fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItemBuilder::with_id("open", "Open ɳTask").build(app)?;
    let sync = MenuItemBuilder::with_id("sync", "Sync Now").build(app)?;
    let prefs = MenuItemBuilder::with_id("prefs", "Preferences…").build(app)?;

    // Initialize checked state from the real OS autostart registration so the
    // menu never lies about whether launch-at-login is actually on — e.g.
    // after a manual uninstall/reinstall of the launch agent.
    let login_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let login = CheckMenuItemBuilder::with_id(LOGIN_ITEM_ID, "Launch at Login")
        .checked(login_enabled)
        .build(app)?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit ɳTask").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&open, &sep1, &sync, &prefs, &sep2, &login, &sep3, &quit])
        .build()?;

    // Cloned into the on_menu_event closure below so the "login" handler can
    // flip this exact checkbox's displayed state after toggling autostart —
    // looking it back up by ID through app.menu() would find the *window*
    // menu bar, not this tray's own menu (they're separate Menu trees).
    let login_item = login.clone();

    TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("ɳTask")
        .on_menu_event(move |app, event| match event.id().as_ref() {
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
                // Single-window app: navigate the main webview to /settings
                // rather than opening a second OS window (native app feel).
                // Uses pushState + popstate dispatch (spa_nav) so React Router
                // picks up the route change client-side instead of a full
                // page reload (which a raw location.pathname assignment
                // would trigger).
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.eval(spa_navigate_js("/settings"));
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "login" => {
                // Toggle real OS autostart registration directly (no frontend
                // round-trip needed — this is a native menu, not a webview
                // control). Reflect the resulting state back onto the
                // checkbox so it never drifts from what's actually registered.
                let autolaunch = app.autolaunch();
                let currently_enabled = autolaunch.is_enabled().unwrap_or(false);
                let toggle_result = if currently_enabled {
                    autolaunch.disable()
                } else {
                    autolaunch.enable()
                };

                match toggle_result {
                    Ok(()) => {
                        let new_state = !currently_enabled;
                        tracing::info!("Launch at Login set to: {}", new_state);
                        let _ = login_item.set_checked(new_state);
                        // Notify the frontend for any UI (e.g. Settings screen) that
                        // mirrors this preference — best-effort, not required for
                        // the toggle itself to work.
                        let _ = app.emit("tray://launch-at-login-changed", new_state);
                    }
                    Err(e) => {
                        tracing::error!("Failed to toggle Launch at Login: {}", e);
                    }
                }
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
