use crate::window;
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn toggle_shortcut_label() -> &'static str {
    if cfg!(debug_assertions) {
        "Alt+O"
    } else {
        "Alt+P"
    }
}

pub fn register(app: &AppHandle) -> Result<(), String> {
    let shortcut_code = if cfg!(debug_assertions) {
        Code::KeyO
    } else {
        Code::KeyP
    };
    let shortcut = Shortcut::new(Some(Modifiers::ALT), shortcut_code);

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                window::toggle(app);
            }
        })
        .map_err(|e| format!("Falha ao registrar shortcut: {}", e))?;

    Ok(())
}
