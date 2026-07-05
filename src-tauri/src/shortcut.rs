use crate::window;
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn toggle_shortcut_label() -> &'static str {
    if cfg!(debug_assertions) {
        "Alt+L"
    } else {
        "Alt+K"
    }
}

fn register_toggle_shortcut(app: &AppHandle, code: Code) -> Result<(), String> {
    let shortcut = Shortcut::new(Some(Modifiers::ALT), code);

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                window::toggle(app);
            }
        })
        .map_err(|e| format!("Falha ao registrar shortcut: {}", e))?;

    Ok(())
}

pub fn register(app: &AppHandle) -> Result<(), String> {
    if cfg!(debug_assertions) {
        register_toggle_shortcut(app, Code::KeyL)?;
        register_toggle_shortcut(app, Code::KeyO)?;
    } else {
        register_toggle_shortcut(app, Code::KeyK)?;
    }

    Ok(())
}
