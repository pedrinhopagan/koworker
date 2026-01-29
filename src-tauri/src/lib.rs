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
        .setup(|app| {
            shortcut::register(app.handle())?;
            tray::setup(app)?;
            eprintln!("[KOWORK] Setup completo. Atalho: Alt+O");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erro ao construir aplicacao tauri");

    app.run(tray::handle_run_event);
}
