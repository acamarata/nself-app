// spa_nav.rs — Reliable in-SPA navigation helper for native menu/tray items.
// Purpose: Native menu/tray "Preferences…" items need to send the already-
//          loaded web/ntask React app to a specific route (e.g. /settings)
//          without a full page reload. Directly assigning
//          `window.location.pathname = ...` performs a real browser
//          navigation (full reload of the SPA, losing in-memory state and
//          causing a visible flash) rather than a client-side route change.
//          React Router (and most history-API-based routers) instead listen
//          for `popstate`, which only fires on back/forward/programmatic
//          history navigation — so the reliable way to trigger a client-side
//          route change from outside the React tree is to push a new history
//          entry via `history.pushState` and then manually dispatch a
//          `popstate` event (pushState itself does NOT fire popstate).
// Inputs:  path: the in-app route to navigate to, e.g. "/settings".
// Outputs: A JS snippet string suitable for WebviewWindow::eval().
// Constraints: `path` must be a trusted, hardcoded literal from this codebase
//              (menu/tray item ids) — never pass user-controlled input here,
//              as it is interpolated into a JS string literal for eval().
// SPORT: no new entry (internal navigation helper, not a tracked command).

/// Build a JS snippet that navigates the SPA's client-side router to `path`
/// via `history.pushState` + a manually dispatched `popstate` event, so
/// React Router (or any history-API router) picks up the change without a
/// full page reload.
///
/// `path` is only ever called with hardcoded literals from menu.rs/tray.rs
/// (e.g. "/settings") — never with user input — but is still escaped
/// defensively against embedded quotes/backslashes.
pub fn spa_navigate_js(path: &str) -> String {
    let escaped = path.replace('\\', "\\\\").replace('\'', "\\'");
    format!(
        "(function() {{ \
           window.history.pushState(null, '', '{escaped}'); \
           window.dispatchEvent(new PopStateEvent('popstate')); \
         }})();"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_pushstate_and_popstate_dispatch() {
        let js = spa_navigate_js("/settings");
        assert!(js.contains("history.pushState"));
        assert!(js.contains("'/settings'"));
        assert!(js.contains("dispatchEvent"));
        assert!(js.contains("PopStateEvent"));
    }

    #[test]
    fn escapes_single_quotes_in_path() {
        let js = spa_navigate_js("/a'b");
        assert!(js.contains("/a\\'b"));
    }
}
