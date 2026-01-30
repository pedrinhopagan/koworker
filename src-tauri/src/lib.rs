mod commands;
mod backend;
mod shortcut;
mod tray;
mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("GDK_BACKEND", "x11");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::hide_window,
            commands::show_window,
            commands::toggle_window
        ])
        .setup(|app| {
            backend::start();
            shortcut::register(app.handle())?;
            tray::setup(app)?;
            eprintln!("[KOWORK] Setup completo. Atalho: Alt+O");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erro ao construir aplicacao tauri");

    app.run(|app_handle, event| {
        tray::handle_run_event(app_handle, event);
    });
}
