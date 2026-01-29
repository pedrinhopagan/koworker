use tauri::{AppHandle, Manager, WebviewWindow};

fn get_main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

pub fn toggle(app: &AppHandle) {
    if let Some(window) = get_main_window(app) {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

pub fn show(app: &AppHandle) {
    if let Some(window) = get_main_window(app) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn hide(app: &AppHandle) {
    if let Some(window) = get_main_window(app) {
        let _ = window.hide();
    }
}
