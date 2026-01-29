use crate::window;
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn register(app: &AppHandle) -> Result<(), String> {
    let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::KeyO);

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                window::toggle(app);
            }
        })
        .map_err(|e| format!("Falha ao registrar shortcut: {}", e))?;

    Ok(())
}
