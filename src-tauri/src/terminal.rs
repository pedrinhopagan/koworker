use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

static MONITOR_HANDLE: OnceLock<Arc<Mutex<Option<thread::JoinHandle<()>>>>> = OnceLock::new();
static KNOWN_SESSIONS: OnceLock<Arc<Mutex<Vec<SessionInfo>>>> = OnceLock::new();

fn get_known_sessions() -> &'static Arc<Mutex<Vec<SessionInfo>>> {
    KNOWN_SESSIONS.get_or_init(|| Arc::new(Mutex::new(Vec::new())))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub project_id: String,
    pub session_name: String,
    pub windows: Vec<WindowInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub task_id: String,
    pub window_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTerminalResult {
    pub session_name: String,
    pub window_name: String,
    pub is_new_session: bool,
    pub is_new_window: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalEvent {
    pub event_type: String,
    pub project_id: String,
    pub task_id: Option<String>,
    pub session_name: String,
    pub window_name: Option<String>,
}

fn session_name_for_project(project_id: &str) -> String {
    let short_id = if project_id.len() >= 8 {
        &project_id[..8]
    } else {
        project_id
    };
    format!("kowork_{}", short_id)
}

fn window_name_for_task(task_id: &str, task_title: &str) -> String {
    let short_id = if task_id.len() >= 8 {
        &task_id[..8]
    } else {
        task_id
    };

    let sanitized_title: String = task_title
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .take(20)
        .collect::<String>()
        .trim()
        .replace(' ', "_")
        .to_lowercase();

    if sanitized_title.is_empty() {
        short_id.to_string()
    } else {
        format!("{}_{}", short_id, sanitized_title)
    }
}

fn tmux_session_exists(session_name: &str) -> bool {
    Command::new("tmux")
        .args(["has-session", "-t", session_name])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn tmux_window_exists(session_name: &str, window_name: &str) -> bool {
    let output = Command::new("tmux")
        .args(["list-windows", "-t", session_name, "-F", "#{window_name}"])
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.lines().any(|line| line == window_name)
        }
        Err(_) => false,
    }
}

fn create_tmux_session(
    session_name: &str,
    working_dir: &str,
    window_name: &str,
) -> Result<(), String> {
    let status = Command::new("tmux")
        .args([
            "new-session",
            "-d",
            "-s",
            session_name,
            "-n",
            window_name,
            "-c",
            working_dir,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .map_err(|e| format!("Falha ao criar sessão tmux: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("Falha ao criar sessão tmux".to_string())
    }
}

fn create_tmux_window(
    session_name: &str,
    window_name: &str,
    working_dir: &str,
) -> Result<(), String> {
    let status = Command::new("tmux")
        .args([
            "new-window",
            "-t",
            session_name,
            "-n",
            window_name,
            "-c",
            working_dir,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .map_err(|e| format!("Falha ao criar window tmux: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("Falha ao criar window tmux".to_string())
    }
}

fn select_tmux_window(session_name: &str, window_name: &str) -> Result<(), String> {
    let target = format!("{}:{}", session_name, window_name);
    Command::new("tmux")
        .args(["select-window", "-t", &target])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| format!("Falha ao selecionar window: {}", e))?;
    Ok(())
}

fn send_command_to_tmux(
    session_name: &str,
    window_name: &str,
    command: &str,
) -> Result<(), String> {
    let target = format!("{}:{}", session_name, window_name);
    let status = Command::new("tmux")
        .args(["send-keys", "-t", &target, command, "Enter"])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .map_err(|e| format!("Falha ao enviar comando: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("Falha ao enviar comando para tmux".to_string())
    }
}

fn spawn_alacritty_with_tmux(session_name: &str, title: &str) -> Result<u32, String> {
    let child = Command::new("alacritty")
        .args([
            "--title",
            title,
            "-e",
            "tmux",
            "attach-session",
            "-t",
            session_name,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Falha ao abrir alacritty: {}", e))?;

    Ok(child.id())
}

fn is_wayland() -> bool {
    std::env::var("WAYLAND_DISPLAY").is_ok()
        || std::env::var("XDG_SESSION_TYPE")
            .map(|v| v == "wayland")
            .unwrap_or(false)
}

/// Foca na janela do terminal do projeto específico
/// O título da janela segue o padrão "{project_name} - Kowork"
fn focus_terminal_window(project_name: &str) -> Result<(), String> {
    let window_title = format!("{} - Kowork", project_name);

    if is_wayland() {
        focus_with_kdotool(&window_title)
    } else {
        focus_with_xdotool(&window_title)
    }
}

fn focus_with_kdotool(window_title: &str) -> Result<(), String> {
    // Buscar janelas com o título exato do projeto
    let title_output = Command::new("kdotool")
        .args(["search", "--name", window_title])
        .output();

    // Buscar janelas da classe "Alacritty"
    let class_output = Command::new("kdotool")
        .args(["search", "--class", "Alacritty"])
        .output();

    // Fazer interseção: janelas que são Alacritty E têm o título do projeto
    if let (Ok(title_out), Ok(class_out)) = (title_output, class_output) {
        let title_ids: std::collections::HashSet<String> =
            String::from_utf8_lossy(&title_out.stdout)
                .lines()
                .map(|s| s.to_string())
                .collect();

        let class_ids: Vec<String> = String::from_utf8_lossy(&class_out.stdout)
            .lines()
            .map(|s| s.to_string())
            .collect();

        // Encontrar janela que é Alacritty E tem o título correto
        for window_id in class_ids {
            if !window_id.is_empty() && title_ids.contains(&window_id) {
                let _ = Command::new("kdotool")
                    .args(["windowactivate", &window_id])
                    .status();
                return Ok(());
            }
        }
    }

    Ok(())
}

fn focus_with_xdotool(window_title: &str) -> Result<(), String> {
    // Buscar janelas com o título exato do projeto
    let title_output = Command::new("xdotool")
        .args(["search", "--name", window_title])
        .output();

    // Buscar janelas da classe "Alacritty"
    let class_output = Command::new("xdotool")
        .args(["search", "--class", "Alacritty"])
        .output();

    // Fazer interseção
    if let (Ok(title_out), Ok(class_out)) = (title_output, class_output) {
        let title_ids: std::collections::HashSet<String> =
            String::from_utf8_lossy(&title_out.stdout)
                .lines()
                .map(|s| s.to_string())
                .collect();

        let class_ids: Vec<String> = String::from_utf8_lossy(&class_out.stdout)
            .lines()
            .map(|s| s.to_string())
            .collect();

        for window_id in class_ids {
            if !window_id.is_empty() && title_ids.contains(&window_id) {
                let _ = Command::new("xdotool")
                    .args(["windowactivate", "--sync", &window_id])
                    .status();
                let _ = Command::new("xdotool")
                    .args(["windowraise", &window_id])
                    .status();
                return Ok(());
            }
        }
    }

    Ok(())
}

fn terminal_process_exists_for_session(session_name: &str) -> bool {
    let output = Command::new("pgrep")
        .args(["-f", &format!("tmux.*attach.*{}", session_name)])
        .output();

    match output {
        Ok(o) => !o.stdout.is_empty(),
        Err(_) => false,
    }
}

fn notify_backend(event: &TerminalEvent) {
    let event_json = match serde_json::to_string(event) {
        Ok(json) => json,
        Err(_) => return,
    };

    let _ = Command::new("curl")
        .args([
            "-s",
            "-X",
            "POST",
            "-H",
            "Content-Type: application/json",
            "-d",
            &event_json,
            "http://127.0.0.1:3000/api/terminal/notify",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

fn update_known_session(project_id: &str, session_name: &str, task_id: &str, window_name: &str) {
    let sessions = get_known_sessions();
    let mut guard = sessions.lock().unwrap();

    if let Some(session) = guard.iter_mut().find(|s| s.project_id == project_id) {
        if !session.windows.iter().any(|w| w.task_id == task_id) {
            session.windows.push(WindowInfo {
                task_id: task_id.to_string(),
                window_name: window_name.to_string(),
            });
        }
    } else {
        guard.push(SessionInfo {
            project_id: project_id.to_string(),
            session_name: session_name.to_string(),
            windows: vec![WindowInfo {
                task_id: task_id.to_string(),
                window_name: window_name.to_string(),
            }],
        });
    }
}

fn remove_known_session(project_id: &str) {
    let sessions = get_known_sessions();
    let mut guard = sessions.lock().unwrap();
    guard.retain(|s| s.project_id != project_id);
}

fn remove_known_window(project_id: &str, task_id: &str) {
    let sessions = get_known_sessions();
    let mut guard = sessions.lock().unwrap();

    if let Some(session) = guard.iter_mut().find(|s| s.project_id == project_id) {
        session.windows.retain(|w| w.task_id != task_id);
    }
}

#[tauri::command(rename_all = "camelCase")]
#[allow(clippy::too_many_arguments)]
pub fn open_terminal_for_task(
    project_id: String,
    project_name: String,
    main_route: String,
    task_id: String,
    task_title: String,
    model: String,
    prompt: Option<String>,
) -> Result<OpenTerminalResult, String> {
    let session_name = session_name_for_project(&project_id);
    let window_name = window_name_for_task(&task_id, &task_title);
    let terminal_title = format!("{} - Kowork", project_name);

    let mut is_new_session = false;
    let mut is_new_window = false;

    if !tmux_session_exists(&session_name) {
        // Criar sessão já com o nome correto da window inicial
        create_tmux_session(&session_name, &main_route, &window_name)?;

        spawn_alacritty_with_tmux(&session_name, &terminal_title)?;
        is_new_session = true;
        is_new_window = true;

        std::thread::sleep(Duration::from_millis(500));

        notify_backend(&TerminalEvent {
            event_type: "session_opened".to_string(),
            project_id: project_id.clone(),
            task_id: None,
            session_name: session_name.clone(),
            window_name: None,
        });

        notify_backend(&TerminalEvent {
            event_type: "window_opened".to_string(),
            project_id: project_id.clone(),
            task_id: Some(task_id.clone()),
            session_name: session_name.clone(),
            window_name: Some(window_name.clone()),
        });
    } else {
        if !terminal_process_exists_for_session(&session_name) {
            spawn_alacritty_with_tmux(&session_name, &terminal_title)?;
            std::thread::sleep(Duration::from_millis(300));
        }

        focus_terminal_window(&project_name)?;

        // Se a window da task não existe, criar nova
        if !tmux_window_exists(&session_name, &window_name) {
            create_tmux_window(&session_name, &window_name, &main_route)?;
            is_new_window = true;

            notify_backend(&TerminalEvent {
                event_type: "window_opened".to_string(),
                project_id: project_id.clone(),
                task_id: Some(task_id.clone()),
                session_name: session_name.clone(),
                window_name: Some(window_name.clone()),
            });
        }
    }

    select_tmux_window(&session_name, &window_name)?;

    if let Some(prompt_text) = prompt {
        let escaped_prompt = prompt_text
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('$', "\\$")
            .replace('`', "\\`");

        let command = format!(
            "opencode run --model {} --prompt \"{}\"",
            model, escaped_prompt
        );
        send_command_to_tmux(&session_name, &window_name, &command)?;
    }

    update_known_session(&project_id, &session_name, &task_id, &window_name);

    start_session_monitor();

    Ok(OpenTerminalResult {
        session_name,
        window_name,
        is_new_session,
        is_new_window,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn close_project_session(project_id: String) -> Result<(), String> {
    let session_name = session_name_for_project(&project_id);

    if tmux_session_exists(&session_name) {
        let status = Command::new("tmux")
            .args(["kill-session", "-t", &session_name])
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .status()
            .map_err(|e| format!("Falha ao encerrar sessão: {}", e))?;

        if !status.success() {
            return Err("Falha ao encerrar sessão tmux".to_string());
        }

        remove_known_session(&project_id);

        notify_backend(&TerminalEvent {
            event_type: "session_closed".to_string(),
            project_id,
            task_id: None,
            session_name,
            window_name: None,
        });
    }

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn close_task_window(
    project_id: String,
    task_id: String,
    task_title: String,
) -> Result<(), String> {
    let session_name = session_name_for_project(&project_id);
    let window_name = window_name_for_task(&task_id, &task_title);

    if tmux_session_exists(&session_name) && tmux_window_exists(&session_name, &window_name) {
        let target = format!("{}:{}", session_name, window_name);
        let status = Command::new("tmux")
            .args(["kill-window", "-t", &target])
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .status()
            .map_err(|e| format!("Falha ao fechar window: {}", e))?;

        if !status.success() {
            return Err("Falha ao fechar window tmux".to_string());
        }

        remove_known_window(&project_id, &task_id);

        notify_backend(&TerminalEvent {
            event_type: "window_closed".to_string(),
            project_id,
            task_id: Some(task_id),
            session_name,
            window_name: Some(window_name),
        });
    }

    Ok(())
}

#[tauri::command]
pub fn get_active_sessions() -> Result<Vec<SessionInfo>, String> {
    let sessions = get_known_sessions();
    let guard = sessions.lock().unwrap();

    let active: Vec<SessionInfo> = guard
        .iter()
        .filter(|s| tmux_session_exists(&s.session_name))
        .cloned()
        .collect();

    Ok(active)
}

#[tauri::command(rename_all = "camelCase")]
pub fn check_session_exists(project_id: String) -> bool {
    let session_name = session_name_for_project(&project_id);
    tmux_session_exists(&session_name)
}

fn start_session_monitor() {
    let handle_lock = MONITOR_HANDLE.get_or_init(|| Arc::new(Mutex::new(None)));

    let mut guard = handle_lock.lock().unwrap();
    if guard.is_some() {
        return;
    }

    let handle = thread::spawn(|| loop {
        thread::sleep(Duration::from_secs(3));

        let sessions = get_known_sessions();
        let known: Vec<SessionInfo> = {
            let guard = sessions.lock().unwrap();
            guard.clone()
        };

        for session in known {
            if !tmux_session_exists(&session.session_name) {
                notify_backend(&TerminalEvent {
                    event_type: "session_closed".to_string(),
                    project_id: session.project_id.clone(),
                    task_id: None,
                    session_name: session.session_name.clone(),
                    window_name: None,
                });

                remove_known_session(&session.project_id);
            }
        }

        let remaining = {
            let guard = sessions.lock().unwrap();
            guard.len()
        };

        if remaining == 0 {
            break;
        }
    });

    *guard = Some(handle);
}
