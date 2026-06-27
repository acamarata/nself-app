// build.rs — Tauri 2 build script for ɳTask desktop.
// Purpose: Runs tauri_build::build() to generate resources required by
//          tauri::generate_context!() at compile time.
// Constraints: Must remain minimal — no business logic here.
fn main() {
    tauri_build::build();
}
