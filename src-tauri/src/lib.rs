mod backend;
mod commands;
mod shortcut;
mod tray;
mod window;

use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("GDK_BACKEND", "x11");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            commands::hide_window,
            commands::show_window,
            commands::toggle_window,
            commands::pick_project_folder,
            commands::open_devtools
        ])
        .setup(|app| {
            backend::start(app.handle());
            // Autostart cross-platform pelo plugin (grava .desktop no Linux, chave de registro no
            // Windows, LaunchAgent no macOS). Só em release: em dev o executavel é o binario de
            // desenvolvimento e nao deve entrar na inicializacao do SO.
            if !cfg!(debug_assertions) {
                if let Err(error) = app.autolaunch().enable() {
                    eprintln!(
                        "[KOWORK] Falha ao configurar inicializacao automatica: {}",
                        error
                    );
                }
            }
            shortcut::register(app.handle())?;
            tray::setup(app)?;
            // O app sobe oculto na tray (visible:false) tanto no autostart quanto no launch normal.
            // O hot-deploy seta esta env ao relancar pra que, apos um build, a janela ja apareca
            // com a versao nova em vez de ficar escondida.
            if std::env::var_os("KOWORK_SHOW_ON_START").is_some() {
                window::show(app.handle());
            }
            eprintln!(
                "[KOWORK] Setup completo. Atalho: {}",
                shortcut::toggle_shortcut_label()
            );
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erro ao construir aplicacao tauri");

    app.run(|app_handle, event| {
        tray::handle_run_event(app_handle, event);
    });
}
