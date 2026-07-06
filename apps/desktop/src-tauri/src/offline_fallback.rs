// offline_fallback.rs — Graceful "can't reach ɳTask" screen for the desktop shell.
// Purpose: The main window's `url` (tauri.conf.json) points at the live
//          https://task.nself.org SPA. If that host is unreachable at launch
//          (no network, DNS down, server down), the OS webview would otherwise
//          show its own ugly native error page (or a blank white window) with
//          no ɳTask branding and no way to retry short of quitting.
//          This module does a lightweight TCP reachability pre-flight before
//          the window finishes loading and, on failure, navigates the window
//          to a bundled `data:` URL fallback page with a Retry button.
// Inputs:  WebviewWindow (the "main" window), the configured remote URL.
// Outputs: Either lets the live navigation proceed (host reachable), or
//          replaces it with the local fallback page (host unreachable).
// Constraints: No external HTTP client dependency — uses a plain TCP connect
//              (std::net::TcpStream) against host:443 with a short timeout,
//              which is enough to distinguish "network/DNS/server down" from
//              "reachable" without pulling in reqwest/hyper as a direct dep.
//              The fallback page is fully self-contained (inline CSS, no
//              external requests) so it renders even fully offline.
// SPORT: F08-SERVICE-INVENTORY — desktop-offline-fallback

use std::net::ToSocketAddrs;
use std::time::Duration;
use tauri::Manager;

/// How long to wait for a TCP connect before treating the host as unreachable.
const PREFLIGHT_TIMEOUT: Duration = Duration::from_secs(4);

/// Self-contained fallback HTML shown when the live ɳTask host is unreachable.
/// Inline styles only — no external CSS/JS/font/image requests — so it
/// renders correctly even with zero network connectivity.
const FALLBACK_HTML: &str = r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ɳTask — Can't Connect</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0b0d12;
    color: #e6e8ec;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    max-width: 420px;
    text-align: center;
    padding: 40px 32px;
  }
  .glyph {
    font-size: 48px;
    line-height: 1;
    margin-bottom: 20px;
    opacity: 0.9;
  }
  h1 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 12px;
  }
  p {
    font-size: 14px;
    line-height: 1.5;
    color: #9aa1ac;
    margin: 0 0 28px;
  }
  button {
    appearance: none;
    border: none;
    border-radius: 8px;
    background: #4f7cff;
    color: white;
    font-size: 14px;
    font-weight: 600;
    padding: 10px 24px;
    cursor: pointer;
  }
  button:hover { background: #3d67e8; }
  button:active { transform: translateY(1px); }
  .retry-status {
    margin-top: 16px;
    font-size: 12px;
    color: #6b7280;
    min-height: 16px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="glyph">ɳ</div>
    <h1>Can't reach ɳTask</h1>
    <p>Check your internet connection, then try again. If the problem
       continues, ɳTask's servers may be temporarily unavailable.</p>
    <button id="retry-btn">Retry</button>
    <div class="retry-status" id="retry-status"></div>
  </div>
  <script>
    // No Tauri IPC available on a data: URL, so retry is a plain top-level
    // navigation back to the live app. If it's still unreachable the OS/
    // webview will show its native error again momentarily, or (once Rust
    // re-runs the preflight on next launch) this page again.
    document.getElementById('retry-btn').addEventListener('click', function () {
      var status = document.getElementById('retry-status');
      status.textContent = 'Retrying…';
      window.location.href = "__RETRY_URL__";
    });
  </script>
</body>
</html>"##;

/// Build the `data:` URL for the fallback page, with the real target URL
/// spliced in so the Retry button navigates back to the actual live app.
fn fallback_data_url(retry_url: &str) -> String {
    let html = FALLBACK_HTML.replace("__RETRY_URL__", retry_url);
    format!(
        "data:text/html;charset=utf-8,{}",
        urlencoding_minimal(&html)
    )
}

/// Minimal percent-encoding sufficient for embedding HTML in a data: URL
/// (no external crate needed — only a handful of reserved characters must
/// be escaped for the URL to parse correctly).
fn urlencoding_minimal(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'#' => out.push_str("%23"),
            b'%' => out.push_str("%25"),
            b'"' => out.push_str("%22"),
            b'\'' => out.push_str("%27"),
            _ => out.push(byte as char),
        }
    }
    out
}

/// Returns true if a TCP connection to `host:443` succeeds within
/// [`PREFLIGHT_TIMEOUT`]. Used as a cheap "is the internet/host up" signal
/// before letting the webview attempt the real HTTPS navigation.
fn host_is_reachable(host: &str) -> bool {
    let addr = format!("{}:443", host);
    match addr.to_socket_addrs() {
        Ok(mut addrs) => match addrs.next() {
            Some(sock_addr) => std::net::TcpStream::connect_timeout(&sock_addr, PREFLIGHT_TIMEOUT)
                .is_ok(),
            None => false,
        },
        Err(_) => false, // DNS resolution failed
    }
}

/// Runs the reachability pre-flight for the main window's configured URL and,
/// if unreachable, navigates the window to the bundled offline fallback page.
/// Called once from lib.rs `setup()`, on a background thread so it never
/// blocks the window from appearing.
pub fn check_and_apply(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let Some(window) = app_handle.get_webview_window("main") else {
            return;
        };

        let Ok(current_url) = window.url() else {
            return;
        };

        let Some(host) = current_url.host_str() else {
            return; // not a network URL (e.g. already a data:/tauri: URL) — nothing to check
        };

        if host_is_reachable(host) {
            tracing::debug!("Preflight OK: {} is reachable", host);
            return;
        }

        tracing::warn!(
            "Preflight failed: {} unreachable within {:?} — showing offline fallback",
            host,
            PREFLIGHT_TIMEOUT
        );

        let fallback_url = fallback_data_url(current_url.as_str());
        match tauri::Url::parse(&fallback_url) {
            Ok(url) => {
                if let Err(e) = window.navigate(url) {
                    tracing::error!("Failed to navigate to offline fallback page: {}", e);
                }
            }
            Err(e) => tracing::error!("Failed to build offline fallback data URL: {}", e),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unreachable_host_returns_false_quickly() {
        // TEST-NET-1 (RFC 5737) — reserved, guaranteed non-routable, so this
        // never depends on real network state or an external service being up.
        // Uses a short-circuiting port that should refuse/timeout fast.
        assert!(!host_is_reachable("192.0.2.1"));
    }

    #[test]
    fn invalid_host_returns_false() {
        assert!(!host_is_reachable("this-host-does-not-exist.invalid"));
    }

    #[test]
    fn fallback_html_embeds_retry_url() {
        let url = fallback_data_url("https://task.nself.org/welcome?app=desktop");
        assert!(url.starts_with("data:text/html;charset=utf-8,"));
        assert!(url.contains("task.nself.org"));
    }

    #[test]
    fn urlencoding_escapes_reserved_chars() {
        let encoded = urlencoding_minimal("100% \"quoted\" #fragment 'val'");
        assert!(!encoded.contains('#'));
        assert!(!encoded.contains('"'));
        assert!(!encoded.contains('\''));
        // Raw % must always be escaped first so the encoded output doesn't
        // accidentally contain a spurious percent-escape sequence.
        assert!(encoded.contains("%25"));
    }
}
