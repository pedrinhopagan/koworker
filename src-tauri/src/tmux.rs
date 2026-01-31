use std::process::Command;

use crate::pty::validate_cwd;

fn validate_label(label: &str) -> Result<String, String> {
    let trimmed = label.trim();
    if trimmed.is_empty() {
        return Err("label invalido".into());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("label invalido".into());
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
pub fn tmux_has_session(session: String) -> Result<bool, String> {
    let session = validate_label(&session)?;
    let status = Command::new("tmux")
        .arg("has-session")
        .arg("-t")
        .arg(&session)
        .status()
        .map_err(|e| format!("falha ao executar tmux: {e}"))?;

    if status.success() {
        return Ok(true);
    }

    if status.code() == Some(1) {
        return Ok(false);
    }

    Err("falha ao verificar sessao tmux".into())
}

#[tauri::command]
pub fn tmux_kill_session(session: String) -> Result<(), String> {
    let session = validate_label(&session)?;
    let status = Command::new("tmux")
        .arg("kill-session")
        .arg("-t")
        .arg(&session)
        .status()
        .map_err(|e| format!("falha ao executar tmux: {e}"))?;

    if status.success() || status.code() == Some(1) {
        return Ok(());
    }

    Err("falha ao encerrar sessao tmux".into())
}

#[tauri::command]
pub fn tmux_new_window(
    session: String,
    name: String,
    cwd: String,
    cmd: Vec<String>,
) -> Result<(), String> {
    let session = validate_label(&session)?;
    let name = validate_label(&name)?;
    let cwd = validate_cwd(&cwd)?;

    if cmd.is_empty() {
        return Err("cmd nao pode ser vazio".into());
    }

    let bin = cmd[0].trim();
    if bin != "bash" {
        return Err("cmd nao permitido".into());
    }

    let mut command = Command::new("tmux");
    command
        .arg("new-window")
        .arg("-t")
        .arg(&session)
        .arg("-n")
        .arg(&name)
        .arg("-c")
        .arg(cwd);

    for part in cmd {
        command.arg(part);
    }

    let status = command
        .status()
        .map_err(|e| format!("falha ao executar tmux: {e}"))?;

    if status.success() {
        return Ok(());
    }

    Err("falha ao criar janela tmux".into())
}
