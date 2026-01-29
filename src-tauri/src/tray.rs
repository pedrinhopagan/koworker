use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    App, RunEvent, WindowEvent,
};

use crate::window;

pub fn setup(app: &App) -> Result<TrayIcon, Box<dyn std::error::Error>> {
    let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
        Image::from_bytes(include_bytes!("../icons/32x32.png")).expect("Falha ao carregar icone")
    });

    let show_item = MenuItem::with_id(app, "show", "Abrir Kowork", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let tray = TrayIconBuilder::with_id("kowork-tray")
        .icon(icon)
        .tooltip("Kowork - Alt+O para abrir")
        .icon_as_template(false)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => window::show(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                if button == tauri::tray::MouseButton::Left {
                    window::toggle(tray.app_handle());
                }
            }
        })
        .build(app)?;

    Ok(tray)
}

pub fn handle_run_event(app_handle: &tauri::AppHandle, event: RunEvent) {
    if let RunEvent::WindowEvent { label, event, .. } = event {
        if label == "main" {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window::hide(app_handle);
            }
        }
    }
}
