use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::Shutdown;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::time::Duration;

use tauri::AppHandle;

use crate::window;

fn socket_path() -> PathBuf {
    let dir = env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir);

    if cfg!(debug_assertions) {
        dir.join("kowork-dev.sock")
    } else {
        dir.join("kowork.sock")
    }
}

fn cli_command() -> Option<&'static str> {
    for arg in env::args().skip(1) {
        match arg.as_str() {
            "--toggle" => return Some("toggle"),
            "--show" => return Some("show"),
            "--hide" => return Some("hide"),
            _ => {}
        }
    }

    None
}

pub fn should_show_on_start() -> bool {
    matches!(cli_command(), Some("show" | "toggle"))
}

pub fn forward_to_running_instance() -> bool {
    let Ok(mut stream) = UnixStream::connect(socket_path()) else {
        return false;
    };

    let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));

    if stream.write_all(cli_command().unwrap_or("show").as_bytes()).is_err() {
        return false;
    }
    if stream.shutdown(Shutdown::Write).is_err() {
        return false;
    }

    let mut ack = [0u8; 2];
    stream.read_exact(&mut ack).is_ok() && &ack == b"ok"
}

pub fn listen(app: AppHandle) {
    let path = socket_path();
    let _ = fs::remove_file(&path);

    let listener = match UnixListener::bind(&path) {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!(
                "[KOWORK] Falha ao abrir socket de controle {}: {}",
                path.display(),
                error
            );
            return;
        }
    };

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };

            let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));

            let mut command = String::new();
            if stream.read_to_string(&mut command).is_err() {
                continue;
            }

            let task_app = app.clone();
            let dispatched = app.run_on_main_thread(move || match command.trim() {
                "toggle" => window::toggle(&task_app),
                "hide" => window::hide(&task_app),
                _ => window::show(&task_app),
            });

            if dispatched.is_ok() {
                let _ = stream.write_all(b"ok");
            }
        }
    });
}
