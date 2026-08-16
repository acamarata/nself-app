// lib.rs — Tauri 2 application library for ɳTask desktop.
// Purpose: Register all plugins, IPC commands, tray icon, native menu,
//          global shortcuts, window-state persistence, and close-to-tray
//          behaviour. Wires auto-update check on launch.
// Inputs:  tauri.conf.json, capabilities/default.json, bundled tray icons.
// Outputs: Running Tauri 2 application.
// Constraints: No business logic — all logic in web/ntask SPA or @nself/*
//              packages. Never access Rust directly from TS via window.__TAURI__;
//              always use @nself/tauri-bridge typed API.
// SPORT: F12-REPO-TYPE-MAP — ntask/apps/desktop

mod commands;
mod downgrade_guard;
mod menu;
mod offline_fallback;
mod spa_nav;
mod tray;

use tauri::{Emitter, Listener, Manager, WindowEvent};
// RunEvent is only referenced by the macOS-only Reopen handler below. Importing it
// unconditionally trips `unused_imports` on Linux/Windows, and these workflows run
// `cargo clippy -- -D warnings`, so the warning would fail the build.
#[cfg(target_os = "macos")]
use tauri::RunEvent;
use tauri_plugin_updater::UpdaterExt;
use tracing_subscriber::{fmt, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Structured logging — level controlled via NTASK_LOG env var.
    fmt()
        .with_env_filter(
            EnvFilter::try_from_env("NTASK_LOG")
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        // ── Plugins (registration order = dependency order) ────────────────
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        // ── IPC command handlers ───────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            // Tray / status
            commands::set_tray_status,
            // Window
            commands::set_window_title,
            // Notifications
            commands::send_notification,
            // File export / import (E-S2-T3)
            commands::export_tasks_csv,
            commands::export_tasks_json,
            commands::import_tasks_json,
            // Secure store — OS keychain for @nself/tauri-bridge TauriSecureStore
            commands::secure_store_get,
            commands::secure_store_set,
            commands::secure_store_delete,
        ])
        // ── App setup ─────────────────────────────────────────────────────
        .setup(|app| {
            // Native macOS / Win / Linux menu bar.
            let menu = menu::build_app_menu(app)?;
            app.set_menu(menu)?;

            // System tray with 3-state icon swap.
            tray::build_tray(app)?;

            // Offline/unreachable fallback: if the live task.nself.org host is
            // down or unreachable at launch, replace the ugly native webview
            // error with a branded "can't reach ɳTask, Retry" screen instead.
            offline_fallback::check_and_apply(app.handle().clone());

            // Global shortcuts: Cmd/Ctrl+Shift+N (quick-add) + Cmd/Ctrl+Shift+T (show/hide).
            // Registered via string parse so CmdOrCtrl resolves correctly on each OS.
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
                let handle = app.handle().clone();
                // on_shortcut takes individual shortcuts; register each separately.
                let h1 = handle.clone();
                app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+N", move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = h1.emit("global-shortcut://quick-add", ());
                    }
                })?;
                let h2 = handle.clone();
                app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+T", move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(win) = h2.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })?;
            }

            // Deep link listener: emit received ntask:// URL to frontend SPA for routing.
            {
                let handle = app.handle().clone();
                app.listen("deep-link://new-url", move |event| {
                    let url = event.payload().to_string();
                    tracing::info!("Deep link received: {}", url);
                    let _ = handle.emit("deep-link", url);
                });
            }

            // Auto-update check on launch — spawned on a blocking thread so the
            // 3-second startup delay does not block the Tauri async runtime.
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Brief pause so the main window is visible before an update
                    // dialog could appear.
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    tauri::async_runtime::block_on(async move {
                    match handle.updater() {
                        Ok(updater) => match updater.check().await {
                            Ok(Some(update)) => {
                                if downgrade_guard::is_upgrade(&update) {
                                    tracing::info!(
                                        "Update available: {} → {}",
                                        update.current_version,
                                        update.version
                                    );
                                    // plugins.updater.dialog = true handles the UI.
                                    let _ = update
                                        .download_and_install(|_, _| {}, || {})
                                        .await;
                                } else {
                                    tracing::warn!(
                                        "Downgrade guard rejected offered version {}",
                                        update.version
                                    );
                                }
                            }
                            Ok(None) => tracing::debug!("App is up to date"),
                            Err(e) => tracing::warn!("Update check failed: {}", e),
                        },
                        Err(e) => tracing::warn!("Updater not available: {}", e),
                    }
                    });
                });
            }

            Ok(())
        })
        // ── Native menu events ─────────────────────────────────────────────
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        // ── Window event — close to tray instead of quitting ───────────────
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Prevent default close; hide to tray instead.
                // User must Quit via tray menu or Cmd+Q to fully exit.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building ɳTask desktop")
        .run(|app_handle, event| {
            // macOS: relaunch/reopen the app after CloseRequested hides the window
            // (e.g. clicking the Dock icon). Without this the Dock click is a silent
            // no-op — the tray "Open" item and global shortcut remain functional,
            // but the natural macOS reopen gesture would otherwise do nothing.
            //
            // RunEvent::Reopen is a macOS-only variant in Tauri 2 — it does not exist
            // in the enum on Linux or Windows, so matching it unconditionally fails to
            // COMPILE there (E0599: no variant named `Reopen`). The macOS job passed
            // while both other desktop builds went red. Hence the cfg gate.
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { has_visible_windows, .. } = event {
                if !has_visible_windows {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }

            // Non-macOS builds have no Reopen gesture; silence unused-binding warnings
            // without changing behaviour.
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app_handle, &event);
            }
        });
}
