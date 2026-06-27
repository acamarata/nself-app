// commands.rs — IPC command handlers for ɳTask desktop.
// Purpose: All #[tauri::command] functions exposed to the web/ntask SPA via invoke().
//          Each is a typed IPC endpoint. Commands are registered in lib.rs
//          via generate_handler![].
// Inputs:  Typed arguments from TS invoke() calls.
// Outputs: Result<T, String> — Ok on success, Err(message) surfaced to TS.
// Constraints: No direct file I/O except via plugin-fs/plugin-dialog APIs.
//              TaskDto must stay in sync with Epic B shared domain types.
// SPORT: F02-COMMAND-INVENTORY — all entries below.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewWindow};

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

/// Task data transfer object matching Epic B shared TypeScript domain types.
/// Field names use camelCase (serde rename_all) to match TS conventions.
/// GAP → Epic B: coordinate `TaskDto` definition before E-S2-T3 lands.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDto {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: Option<String>,
    pub due_date: Option<String>,
    pub list_id: Option<String>,
    pub created_at: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Tray / Status
// ─────────────────────────────────────────────────────────────────────────────

/// Set tray icon state.
/// `state` must be one of: "connected" | "syncing" | "offline".
/// Icon files must exist as bundled resources in tauri.conf.json bundle.resources.
///
/// Called from web/ntask useTrayStatus.ts when offline-queue sync state changes.
#[tauri::command]
pub fn set_tray_status(state: String, app: AppHandle) -> Result<(), String> {
    use tauri::image::Image;

    let icon_name = match state.as_str() {
        "connected" => "icons/tray-connected.png",
        "syncing" => "icons/tray-syncing.png",
        "offline" => "icons/tray-offline.png",
        other => {
            return Err(format!(
                "Unknown tray state '{}'. Expected: connected | syncing | offline",
                other
            ))
        }
    };

    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource dir error: {}", e))?
        .join(icon_name);

    let image = Image::from_path(&resource_path)
        .map_err(|e| format!("failed to load tray icon '{}': {}", icon_name, e))?;

    // Look up the tray by the fixed ID registered in tray.rs.
    if let Some(tray) = app.tray_by_id(crate::tray::TRAY_ID) {
        tray.set_icon(Some(image))
            .map_err(|e| format!("tray.set_icon failed: {}", e))?;
    } else {
        tracing::warn!("Tray icon '{}' not found", crate::tray::TRAY_ID);
    }

    tracing::debug!("Tray status set to: {}", state);
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Window
// ─────────────────────────────────────────────────────────────────────────────

/// Set the OS window title bar text.
/// Used by useSyncStatus.ts to reflect offline / syncing / online state in
/// Alt-Tab, Dock, and taskbar previews.
///
/// In browser context, isTauri() guard in the hook prevents this from being called.
#[tauri::command]
pub fn set_window_title(title: String, window: WebviewWindow) -> Result<(), String> {
    window
        .set_title(&title)
        .map_err(|e| format!("set_title failed: {}", e))?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications (E-S2-T4)
// ─────────────────────────────────────────────────────────────────────────────

/// Fire a native OS notification.
/// Called from web/ntask/src/lib/notifications.ts when a task is due or sync
/// state changes. Guards with isTauri() in the TS caller.
///
/// macOS: requires NSUserNotificationUsageDescription in entitlements.plist.
/// Linux: requires libnotify at runtime.
#[tauri::command]
pub async fn send_notification(
    app: AppHandle,
    title: String,
    body: String,
    _icon: Option<String>,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("notification failed: {}", e))?;

    tracing::debug!("Notification sent: {}", title);
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// File export / import (E-S2-T3)
// ─────────────────────────────────────────────────────────────────────────────

/// Export tasks to CSV via a native save dialog.
/// Writes to the path the user selects (Downloads or Documents scope).
/// Column order: id, title, status, priority, dueDate, listId, createdAt.
#[tauri::command]
pub async fn export_tasks_csv(
    app: AppHandle,
    tasks: Vec<TaskDto>,
) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;

    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let default_name = format!("ntask-export-{}.csv", date);

    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("CSV Files", &["csv"])
        .blocking_save_file();

    let path = match path {
        Some(p) => p,
        None => return Ok(()), // user cancelled — not an error
    };

    let mut wtr = csv::Writer::from_path(path.as_path().unwrap_or(std::path::Path::new("")))
        .map_err(|e| format!("CSV writer error: {}", e))?;

    // Header row.
    wtr.write_record(["id", "title", "status", "priority", "dueDate", "listId", "createdAt"])
        .map_err(|e| format!("CSV header error: {}", e))?;

    for task in &tasks {
        wtr.write_record([
            &task.id,
            &task.title,
            &task.status,
            task.priority.as_deref().unwrap_or(""),
            task.due_date.as_deref().unwrap_or(""),
            task.list_id.as_deref().unwrap_or(""),
            &task.created_at,
        ])
        .map_err(|e| format!("CSV row error: {}", e))?;
    }

    wtr.flush().map_err(|e| format!("CSV flush error: {}", e))?;
    tracing::info!("Exported {} tasks to CSV", tasks.len());
    Ok(())
}

/// Export tasks to JSON via a native save dialog.
/// Serializes the full TaskDto array as a JSON file.
#[tauri::command]
pub async fn export_tasks_json(
    app: AppHandle,
    tasks: Vec<TaskDto>,
) -> Result<(), String> {
    use std::fs;
    use tauri_plugin_dialog::DialogExt;

    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let default_name = format!("ntask-export-{}.json", date);

    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("JSON Files", &["json"])
        .blocking_save_file();

    let path = match path {
        Some(p) => p,
        None => return Ok(()),
    };

    let json = serde_json::to_string_pretty(&tasks)
        .map_err(|e| format!("JSON serialization error: {}", e))?;

    fs::write(path.as_path().unwrap_or(std::path::Path::new("")), &json)
        .map_err(|e| format!("file write error: {}", e))?;

    tracing::info!("Exported {} tasks to JSON", tasks.len());
    Ok(())
}

/// Import tasks from a JSON file via a native open dialog.
/// Returns the deserialized Vec<TaskDto> to the frontend for preview + confirm.
/// The frontend shows a dry-run count before writing to the backend.
#[tauri::command]
pub async fn import_tasks_json(app: AppHandle) -> Result<Vec<TaskDto>, String> {
    use std::fs;
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("JSON Files", &["json"])
        .blocking_pick_file();

    let path = match path {
        Some(p) => p,
        None => return Ok(vec![]), // user cancelled
    };

    let content = fs::read_to_string(path.as_path().unwrap_or(std::path::Path::new("")))
        .map_err(|e| format!("file read error: {}", e))?;

    let tasks: Vec<TaskDto> = serde_json::from_str(&content)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    tracing::info!("Imported {} tasks from JSON (preview — not yet written)", tasks.len());
    Ok(tasks)
}

// ─────────────────────────────────────────────────────────────────────────────
// Secure store — OS keychain (E-S1-T3)
// ─────────────────────────────────────────────────────────────────────────────
// These commands implement SecureStoreInterface from @nself/tauri-bridge/secure-store.ts.
// Service name: org.nself.ntask
// macOS:   Keychain (Security.framework)
// Windows: Credential Manager (DPAPI)
// Linux:   libsecret / kwallet
//
// Current implementation: environment-variable-backed stub.
// Full OS keychain implementation tracked in E-S1-T3.

const KEYCHAIN_SERVICE: &str = "org.nself.ntask";

/// Read a value from the OS keychain by key.
#[tauri::command]
pub fn secure_store_get(key: String) -> Result<Option<String>, String> {
    // TODO(E-S1-T3): Replace with OS keychain read via `keyring` crate or
    // platform Security framework calls. Stub returns None until implemented.
    tracing::debug!("secure_store_get: service={} key={}", KEYCHAIN_SERVICE, key);
    Ok(None)
}

/// Write a value to the OS keychain.
#[tauri::command]
pub fn secure_store_set(key: String, _value: String) -> Result<(), String> {
    // TODO(E-S1-T3): Replace with OS keychain write. Stub is a no-op.
    tracing::debug!("secure_store_set: service={} key={}", KEYCHAIN_SERVICE, key);
    Ok(())
}

/// Delete a value from the OS keychain.
#[tauri::command]
pub fn secure_store_delete(key: String) -> Result<(), String> {
    // TODO(E-S1-T3): Replace with OS keychain delete. Stub is a no-op.
    tracing::debug!("secure_store_delete: service={} key={}", KEYCHAIN_SERVICE, key);
    Ok(())
}
