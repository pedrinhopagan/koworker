use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    thread,
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

const EVENT_DATA: &str = "pty:data";
const EVENT_EXIT: &str = "pty:exit";

// (PtyCreateArgs removed: `pty_create` now receives flat args)

#[derive(Debug, Serialize)]
pub struct PtyCreateResult {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

// (PtyWriteArgs/PtyResizeArgs/PtyKillArgs removed: commands now receive flat args)

#[derive(Clone, Debug, Serialize)]
struct PtyDataEvent {
    #[serde(rename = "sessionId")]
    session_id: String,
    data: String,
}

#[derive(Clone, Debug, Serialize)]
struct PtyExitEvent {
    #[serde(rename = "sessionId")]
    session_id: String,
    code: i32,
}

struct PtySession {
    master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn portable_pty::Child + Send>>,
}

static PTY_SESSIONS: OnceLock<Mutex<HashMap<String, PtySession>>> = OnceLock::new();

fn sessions() -> &'static Mutex<HashMap<String, PtySession>> {
    PTY_SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn repo_root() -> Option<PathBuf> {
    // CARGO_MANIFEST_DIR points to src-tauri; repo root is its parent.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
}

const ALLOWED_BINS: &[&str] = &["bash", "git", "bun", "claude", "opencode", "codex", "tmux"];
const ALLOWED_ENV_KEYS: &[&str] = &["TERM"];

fn validate_cmd(cmd: &str) -> Result<(), String> {
    let trimmed = cmd.trim();
    if trimmed.is_empty() {
        return Err("cmd não pode ser vazio".into());
    }

    // Guardrail: do not allow paths ("/", "\\") or traversal-like invocations.
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.starts_with('.') {
        return Err("cmd deve ser um binário simples (sem paths)".into());
    }

    if !ALLOWED_BINS.contains(&trimmed) {
        return Err(format!(
            "cmd não permitido: {trimmed}. Permitidos: {}",
            ALLOWED_BINS.join(", ")
        ));
    }

    Ok(())
}

fn sanitize_env(env: Option<HashMap<String, String>>) -> Result<Option<HashMap<String, String>>, String> {
    let Some(env) = env else {
        return Ok(None);
    };

    let mut sanitized = HashMap::new();
    for (k, v) in env {
        if ALLOWED_ENV_KEYS.contains(&k.as_str()) {
            sanitized.insert(k, v);
        } else {
            return Err(format!(
                "env key não permitida: {k}. Permitidas: {}",
                ALLOWED_ENV_KEYS.join(", ")
            ));
        }
    }

    Ok(Some(sanitized))
}

pub(crate) fn validate_cwd(cwd: &str) -> Result<PathBuf, String> {
    if cwd.trim().is_empty() {
        return Err("cwd não pode ser vazio".into());
    }

    let cwd_path = Path::new(cwd);
    let cwd_canon = cwd_path
        .canonicalize()
        .map_err(|e| format!("cwd inválido: {e}"))?;

    let root = repo_root().ok_or_else(|| "não foi possível determinar repo root".to_string())?;
    let root_canon = root
        .canonicalize()
        .map_err(|e| format!("repo root inválido: {e}"))?;

    if !cwd_canon.starts_with(&root_canon) {
        return Err(format!(
            "cwd deve estar dentro do repo ({})",
            root_canon.to_string_lossy()
        ));
    }

    Ok(cwd_canon)
}

#[tauri::command]
pub fn pty_create(
    app: AppHandle,
    cwd: String,
    cmd: String,
    args: Vec<String>,
    env: Option<HashMap<String, String>>,
    cols: u16,
    rows: u16,
) -> Result<PtyCreateResult, String> {
    let cwd = validate_cwd(&cwd)?;
    validate_cmd(&cmd)?;

    let env = sanitize_env(env)?;

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("falha ao abrir PTY: {e}"))?;

    let mut cmd = CommandBuilder::new(cmd);
    cmd.args(args);
    cmd.cwd(cwd);

    if let Some(env) = env {
        for (k, v) in env {
            cmd.env(k, v);
        }
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("falha ao spawnar comando: {e}"))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("falha ao clonar reader: {e}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("falha ao obter writer: {e}"))?;

    let session_id = Uuid::new_v4().to_string();

    {
        let mut map = sessions().lock().unwrap();
        map.insert(
            session_id.clone(),
            PtySession {
                master: Mutex::new(pair.master),
                writer: Mutex::new(writer),
                child: Mutex::new(child),
            },
        );
    }

    // Thread de leitura + exit.
    let app_handle = app.clone();
    let sid = session_id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(
                        EVENT_DATA,
                        PtyDataEvent {
                            session_id: sid.clone(),
                            data: chunk,
                        },
                    );
                }
                Err(_) => break,
            }
        }

        // Espera o processo terminar e emite exit.
        let code = {
            let mut map = sessions().lock().unwrap();
            if let Some(sess) = map.get_mut(&sid) {
                let mut child = sess.child.lock().unwrap();
                match child.wait() {
                    Ok(status) => status.exit_code() as i32,
                    Err(_) => -1,
                }
            } else {
                -1
            }
        };

        let _ = app_handle.emit(
            EVENT_EXIT,
            PtyExitEvent {
                session_id: sid.clone(),
                code,
            },
        );

        // Cleanup
        let mut map = sessions().lock().unwrap();
        map.remove(&sid);
    });

    Ok(PtyCreateResult { session_id })
}

#[tauri::command]
pub fn pty_write(session_id: String, data: String) -> Result<(), String> {
    let map = sessions().lock().unwrap();
    let sess = map
        .get(&session_id)
        .ok_or_else(|| "sessionId não encontrado".to_string())?;

    let mut writer = sess.writer.lock().unwrap();
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("falha ao escrever no PTY: {e}"))?;
    writer.flush().ok();
    Ok(())
}

#[tauri::command]
pub fn pty_resize(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let map = sessions().lock().unwrap();
    let sess = map
        .get(&session_id)
        .ok_or_else(|| "sessionId não encontrado".to_string())?;

    let master = sess.master.lock().unwrap();
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("falha ao resize do PTY: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn pty_kill(session_id: String) -> Result<(), String> {
    // Idempotente: se a sessão já foi encerrada/limpa, não precisa falhar.
    let map = sessions().lock().unwrap();
    let Some(sess) = map.get(&session_id) else {
        return Ok(());
    };

    let mut child = sess.child.lock().unwrap();
    child
        .kill()
        .map_err(|e| format!("falha ao matar PTY: {e}"))?;
    Ok(())
}
