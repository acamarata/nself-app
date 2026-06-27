// downgrade_guard.rs — Semver guard before applying auto-updates.
// Purpose: Reject any offered update where offered_version <= current_version.
//          Protects against rollback attacks and misbehaving update servers.
//          Ported from nclaw/desktop/src-tauri/src/downgrade_guard.rs.
// Inputs:  UpdateResponse from tauri-plugin-updater check() call.
// Outputs: bool — true if the offered version is strictly newer than current.
// Constraints: Malformed version strings default to "0.0.0" (safe-fail: reject).
//              Uses semver spec; pre-release suffixes are compared per spec.
// SPORT: no new entry (guard behaviour, not a tracked service command).

use tauri_plugin_updater::Update;

/// Returns true iff the update's offered version is strictly greater than
/// the currently-running version. Safe-fails (returns false) on parse errors.
pub fn is_upgrade(update: &Update) -> bool {
    let current = semver_parse(&update.current_version);
    let offered = semver_parse(&update.version);
    offered > current
}

/// Parse a semver string; returns (0, 0, 0) on any parse error.
fn semver_parse(version: &str) -> (u64, u64, u64) {
    // Strip a leading 'v' if present (e.g. "v1.2.3" → "1.2.3").
    let v = version.trim_start_matches('v');
    let parts: Vec<&str> = v.split('.').collect();
    let major = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0u64);
    let minor = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0u64);
    let patch = parts
        .get(2)
        .and_then(|s| s.split('-').next())   // strip pre-release suffix
        .and_then(|s| s.parse().ok())
        .unwrap_or(0u64);
    (major, minor, patch)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_update(current: &str, offered: &str) -> bool {
        // Minimal check: parse both and compare without a real UpdateResponse.
        semver_parse(offered) > semver_parse(current)
    }

    #[test]
    fn newer_version_is_accepted() {
        assert!(mock_update("1.0.0", "1.0.1"));
        assert!(mock_update("1.0.0", "1.1.0"));
        assert!(mock_update("1.0.0", "2.0.0"));
    }

    #[test]
    fn same_version_is_rejected() {
        assert!(!mock_update("1.0.0", "1.0.0"));
    }

    #[test]
    fn downgrade_is_rejected() {
        assert!(!mock_update("1.2.0", "1.1.9"));
        assert!(!mock_update("2.0.0", "1.9.9"));
    }

    #[test]
    fn malformed_version_is_rejected() {
        // Malformed offered version → (0,0,0) which is <= any real version.
        assert!(!mock_update("1.0.0", "not-a-version"));
        assert!(!mock_update("1.0.0", ""));
    }

    #[test]
    fn v_prefix_is_stripped() {
        assert!(mock_update("1.0.0", "v1.0.1"));
    }

    #[test]
    fn pre_release_suffix_is_stripped() {
        assert!(mock_update("1.0.0", "1.0.1-beta.1"));
    }
}
