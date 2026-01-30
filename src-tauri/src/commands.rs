use tauri::{AppHandle, Manager};

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
