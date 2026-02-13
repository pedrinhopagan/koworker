use std::{
    fs,
    net::TcpStream,
    path::{Path, PathBuf},
    process::{id, Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

static BACKEND: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn state() -> &'static Mutex<Option<Child>> {
    BACKEND.get_or_init(|| Mutex::new(None))
}

fn repo_root() -> Option<PathBuf> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|path| path.to_path_buf())
}

fn server_script() -> Option<PathBuf> {
    let root = repo_root()?;
    let script = root.join("src/server.ts");
    script.exists().then_some(script)
}

fn release_backend_binary(app: &AppHandle) -> Option<(PathBuf, PathBuf)> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .ok()
        .or_else(|| app.path().app_data_dir().ok())?;

    let home = std::env::var("HOME").ok()?;

    let candidates: Vec<(PathBuf, PathBuf)> = vec![
        (
            data_dir.join("bin").join("kowork-backend"),
            data_dir.join("dist"),
        ),
        (
            PathBuf::from(&home).join(".local/lib/kowork/bin/kowork-backend"),
            data_dir.join("dist"),
        ),
    ];

    for (binary, dist_dir) in candidates {
        if binary.exists() && dist_dir.exists() {
            return Some((binary, dist_dir));
        }
    }

    None
}

fn runtime_dir(app: &AppHandle) -> Option<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .ok()
        .or_else(|| app.path().app_data_dir().ok())?;

    fs::create_dir_all(&dir).ok()?;

    Some(dir)
}

fn jwt_secret(runtime_dir: &Path) -> Option<String> {
    let secret_path = runtime_dir.join("jwt.secret");

    if let Ok(existing) = fs::read_to_string(&secret_path) {
        let trimmed = existing.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_nanos();
    let secret = format!("kowork-{}-{}", id(), timestamp);
    fs::write(secret_path, &secret).ok()?;

    Some(secret)
}

#[cfg(unix)]
fn ensure_executable(path: &Path) {
    let Ok(metadata) = fs::metadata(path) else {
        return;
    };

    let mut permissions = metadata.permissions();
    let mode = permissions.mode();
    if mode & 0o111 != 0 {
        return;
    }

    permissions.set_mode(mode | 0o755);
    let _ = fs::set_permissions(path, permissions);
}

#[cfg(not(unix))]
fn ensure_executable(_path: &Path) {}

fn spawn_dev_backend() -> Option<Child> {
    let script = server_script()?;

    let root = repo_root().unwrap_or_else(|| {
        script
            .parent()
            .unwrap_or_else(|| script.as_path())
            .to_path_buf()
    });

    let child = Command::new("bun")
        .arg("--watch")
        .arg(script)
        .current_dir(root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .spawn()
        .ok()?;

    Some(child)
}

fn spawn_release_backend(app: &AppHandle) -> Option<Child> {
    let (binary, dist_dir) = release_backend_binary(app)?;

    ensure_executable(&binary);

    let runtime_dir = runtime_dir(app)?;
    let db_path = runtime_dir.join("kowork.db");
    let secret = jwt_secret(&runtime_dir)?;

    let dist_dir_str = dist_dir.to_string_lossy().to_string();

    let child = Command::new(&binary)
        .current_dir(runtime_dir.clone())
        .env("DATABASE_URL", &db_path)
        .env("JWT_SECRET", &secret)
        .env("NODE_ENV", "production")
        .env("KOWORK_DIST_DIR", &dist_dir_str)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .spawn()
        .ok()?;

    Some(child)
}

fn server_is_running() -> bool {
    TcpStream::connect("127.0.0.1:3000").is_ok()
}

pub fn start(app: &AppHandle) {
    let mut guard = state().lock().unwrap();
    if guard.is_some() {
        return;
    }

    if server_is_running() {
        return;
    }

    let child = if cfg!(debug_assertions) {
        spawn_dev_backend()
    } else {
        spawn_release_backend(app)
    };

    if let Some(child) = child {
        *guard = Some(child);
    }
}

pub fn stop() {
    let mut guard = state().lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}
