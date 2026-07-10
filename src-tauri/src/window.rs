use std::time::Duration;

use tauri::{AppHandle, Manager, WebviewWindow};

fn get_main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn activate(window: &WebviewWindow) {
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }

    let was_visible = window.is_visible().unwrap_or(false);

    let _ = window.show();
    let _ = window.set_focus();

    if !was_visible {
        focus_after_map(window.clone());
    }
}

fn focus_after_map(window: WebviewWindow) {
    std::thread::spawn(move || {
        for _ in 0..12 {
            std::thread::sleep(Duration::from_millis(50));

            if window.is_focused().unwrap_or(false) {
                return;
            }

            if window.is_visible().unwrap_or(false) {
                let _ = window.set_focus();
            }
        }
    });
}

pub fn toggle(app: &AppHandle) {
    let Some(window) = get_main_window(app) else {
        return;
    };

    let visible = window.is_visible().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);

    if visible && !minimized && focused {
        let _ = window.hide();
    } else {
        activate(&window);
    }
}

pub fn show(app: &AppHandle) {
    if let Some(window) = get_main_window(app) {
        activate(&window);
    }
}

pub fn hide(app: &AppHandle) {
    if let Some(window) = get_main_window(app) {
        let _ = window.hide();
    }
}
