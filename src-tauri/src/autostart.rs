use std::{env, fs, path::PathBuf};

use tauri::AppHandle;

#[cfg(target_os = "linux")]
fn config_home() -> Option<PathBuf> {
    if let Some(value) = env::var_os("XDG_CONFIG_HOME") {
        return Some(PathBuf::from(value));
    }

    let home = env::var_os("HOME")?;
    Some(PathBuf::from(home).join(".config"))
}

#[cfg(target_os = "linux")]
fn desktop_entry(exec_path: &str) -> String {
    format!(
        "[Desktop Entry]\nType=Application\nName=Kowork\nComment=Kowork Desktop\nExec=\"{}\"\nTerminal=false\nHidden=false\nX-GNOME-Autostart-enabled=true\n",
        exec_path,
    )
}

#[cfg(target_os = "linux")]
pub fn ensure_enabled(_app: &AppHandle) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Ok(());
    }

    let config_dir =
        config_home().ok_or_else(|| "Nao foi possivel resolver config dir".to_string())?;
    let autostart_dir = config_dir.join("autostart");
    fs::create_dir_all(&autostart_dir)
        .map_err(|error| format!("Falha ao criar pasta de autostart: {}", error))?;

    let executable = env::current_exe()
        .map_err(|error| format!("Falha ao resolver executavel atual: {}", error))?;
    let escaped_exec = executable.to_string_lossy().replace('"', "\\\"");

    fs::write(
        autostart_dir.join("kowork.desktop"),
        desktop_entry(&escaped_exec),
    )
    .map_err(|error| format!("Falha ao escrever arquivo de autostart: {}", error))?;

    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn ensure_enabled(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}
