use tauri::{AppHandle};
use rfd::FileDialog;

use crate::window;

#[tauri::command]
pub fn hide_window(app: AppHandle) {
    window::hide(&app);
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
    dialog.pick_folder().map(|path| path.to_string_lossy().to_string())
}
