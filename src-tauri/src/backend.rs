use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    net::TcpStream,
};

static BACKEND: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn state() -> &'static Mutex<Option<Child>> {
    BACKEND.get_or_init(|| Mutex::new(None))
}

fn repo_root() -> Option<PathBuf> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().map(|path| path.to_path_buf())
}

fn server_script() -> Option<PathBuf> {
    let root = repo_root()?;
    let script = root.join("src/server.ts");
    script.exists().then_some(script)
}

fn server_is_running() -> bool {
    TcpStream::connect("127.0.0.1:3000").is_ok()
}

pub fn start() {
    let mut guard = state().lock().unwrap();
    if guard.is_some() {
        return;
    }

    if server_is_running() {
        return;
    }

    let Some(script) = server_script() else {
        return;
    };

    let root = repo_root().unwrap_or_else(|| script.parent().unwrap_or_else(|| script.as_path()).to_path_buf());
    let mut cmd = Command::new("bun");
    if cfg!(debug_assertions) {
        cmd.arg("--watch");
    }
    let child = cmd
        .arg(script)
        .current_dir(root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .spawn();

    if let Ok(child) = child {
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
