use rfd::FileDialog;
use std::process::Command;
use tauri::{AppHandle, Manager};

use crate::window;

#[tauri::command]
pub fn hide_window(app: AppHandle) {
    window::hide(&app);
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    let expanded_path = shellexpand::tilde(&path).to_string();

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("Erro ao abrir pasta: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("Erro ao abrir pasta: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("Erro ao abrir pasta: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn show_window(app: AppHandle) {
    window::show(&app);
}

#[tauri::command]
pub fn toggle_window(app: AppHandle) {
    window::toggle(&app);
}

#[tauri::command]
pub fn pick_project_folder(start_in: Option<String>) -> Option<String> {
    let mut dialog = FileDialog::new();
    if let Some(path) = start_in {
        dialog = dialog.set_directory(path);
    }
    dialog
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_devtools(app: AppHandle) -> bool {
    let Some(window) = app.get_webview_window("main") else {
        return false;
    };

    window.open_devtools();
    true
}
