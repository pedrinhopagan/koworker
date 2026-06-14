use rfd::FileDialog;
use serde::Serialize;
use std::fs;
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

use crate::window;

#[tauri::command]
pub fn hide_window(app: AppHandle) {
    window::hide(&app);
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    let expanded_path = shellexpand::tilde(&path).to_string();

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("Erro ao abrir pasta: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("Erro ao abrir pasta: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&expanded_path)
            .spawn()
            .map_err(|e| format!("Erro ao abrir pasta: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn show_window(app: AppHandle) {
    window::show(&app);
}

#[tauri::command]
pub fn toggle_window(app: AppHandle) {
    window::toggle(&app);
}

#[tauri::command]
pub fn pick_project_folder(start_in: Option<String>) -> Option<String> {
    let mut dialog = FileDialog::new();
    if let Some(path) = start_in {
        dialog = dialog.set_directory(path);
    }
    dialog
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_devtools(app: AppHandle) -> bool {
    let Some(window) = app.get_webview_window("main") else {
        return false;
    };

    window.open_devtools();
    true
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareZipResult {
    // Se o `.zip` foi colocado no clipboard como arquivo. Falso quando a ferramenta de
    // clipboard não existe/falha — o frontend então revela o zip no gerenciador.
    clipboard: bool,
    zip_path: String,
}

// Compacta a pasta num `.zip` temporário e copia o arquivo pro clipboard (file-URI). O zip
// inclui a própria pasta como raiz, então extrair recria a pasta inteira. Sempre produz o zip;
// o clipboard é best-effort (ver ShareZipResult.clipboard).
#[tauri::command]
pub fn share_folder_as_zip(path: String) -> Result<ShareZipResult, String> {
    let expanded = shellexpand::tilde(&path).to_string();
    let src = PathBuf::from(&expanded);
    if !src.is_dir() {
        return Err(format!("Pasta não encontrada: {}", expanded));
    }

    let zip_path = build_zip(&src)?;
    let clipboard = copy_file_to_clipboard(&zip_path);

    Ok(ShareZipResult {
        clipboard,
        zip_path: zip_path.to_string_lossy().to_string(),
    })
}

fn build_zip(src: &Path) -> Result<PathBuf, String> {
    let base = src
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "compartilhar".to_string());

    let out_dir = std::env::temp_dir().join("koworker-share");
    fs::create_dir_all(&out_dir).map_err(|e| format!("Erro ao criar pasta temporária: {}", e))?;

    let zip_path = out_dir.join(format!("{}.zip", base));
    let _ = fs::remove_file(&zip_path);

    let file = fs::File::create(&zip_path).map_err(|e| format!("Erro ao criar zip: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // Propaga erro de varredura (ex.: subpasta sem permissão) em vez de engolir: um zip incompleto
    // reportado como sucesso enganaria quem compartilha. `file_type()` do walkdir respeita o
    // follow_links(false) — symlink não é descido nem confundido com pasta/arquivo (is_dir/is_file
    // da std seguiriam o link).
    for entry in WalkDir::new(src) {
        let entry = entry.map_err(|e| format!("Erro ao varrer a pasta: {}", e))?;
        let path = entry.path();
        let Ok(rel) = path.strip_prefix(src) else {
            continue;
        };
        if rel.as_os_str().is_empty() {
            continue;
        }

        let name = format!("{}/{}", base, rel.to_string_lossy());
        let file_type = entry.file_type();
        if file_type.is_dir() {
            zip.add_directory(format!("{}/", name), options)
                .map_err(|e| format!("Erro ao adicionar pasta ao zip: {}", e))?;
        } else if file_type.is_file() {
            zip.start_file(name, options)
                .map_err(|e| format!("Erro ao adicionar arquivo ao zip: {}", e))?;
            let bytes = fs::read(path).map_err(|e| format!("Erro ao ler arquivo: {}", e))?;
            zip.write_all(&bytes)
                .map_err(|e| format!("Erro ao escrever no zip: {}", e))?;
        }
    }

    zip.finish()
        .map_err(|e| format!("Erro ao finalizar zip: {}", e))?;
    Ok(zip_path)
}

// Coloca o `.zip` no clipboard como arquivo. No Linux o alvo MIME depende do DE: a família
// GNOME (Nautilus/Nemo/Caja) cola de `x-special/gnome-copied-files`; o resto (KDE, XFCE…)
// cola de `text/uri-list`. Usa `wl-copy` no Wayland e `xclip` no X11. Retorna false se a
// ferramenta não existir/falhar — o chamador revela o zip como fallback.
// Percent-encoda o caminho pro file-URI (RFC 3986), preservando `/` e os unreserved. Sem isso,
// nome de pasta com espaço/acento gera URI não-conforme e o gerenciador de arquivos não cola. Um
// encode mínimo manual evita uma dep só pra isso; bytes multibyte (UTF-8) viram %XX por byte.
#[cfg(target_os = "linux")]
fn encode_uri_path(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    for byte in path.bytes() {
        match byte {
            b'/' | b'-' | b'_' | b'.' | b'~' | b'0'..=b'9' | b'A'..=b'Z' | b'a'..=b'z' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

#[cfg(target_os = "linux")]
fn copy_file_to_clipboard(zip_path: &Path) -> bool {
    let uri = format!("file://{}", encode_uri_path(&zip_path.to_string_lossy()));
    let desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .unwrap_or_default()
        .to_lowercase();
    let gnome_family = ["gnome", "cinnamon", "mate", "unity"]
        .iter()
        .any(|name| desktop.contains(name));

    let (mime, payload) = if gnome_family {
        ("x-special/gnome-copied-files", format!("copy\n{}", uri))
    } else {
        ("text/uri-list", format!("{}\r\n", uri))
    };

    let wayland = std::env::var_os("WAYLAND_DISPLAY").is_some();
    write_to_clipboard(wayland, mime, &payload)
}

#[cfg(target_os = "linux")]
fn write_to_clipboard(wayland: bool, mime: &str, payload: &str) -> bool {
    let mut command = if wayland {
        let mut c = Command::new("wl-copy");
        c.arg("--type").arg(mime);
        c
    } else {
        let mut c = Command::new("xclip");
        c.args(["-selection", "clipboard", "-t", mime]);
        c
    };

    let Ok(mut child) = command.stdin(Stdio::piped()).spawn() else {
        return false;
    };
    let Some(mut stdin) = child.stdin.take() else {
        return false;
    };
    if stdin.write_all(payload.as_bytes()).is_err() {
        return false;
    }

    // wl-copy/xclip leem o stdin até o EOF e ENTÃO forkam o servidor de clipboard em background,
    // saindo no foreground. Fechar o stdin (drop) manda o EOF; o wait() reapa o processo de
    // foreground (sem zumbi acumulando) e o exit code diz se a cópia foi aceita — `clipboard` honesto.
    drop(stdin);
    child.wait().map(|status| status.success()).unwrap_or(false)
}

// macOS/Windows: ainda não copiamos o arquivo pro clipboard — o chamador revela o zip.
#[cfg(not(target_os = "linux"))]
fn copy_file_to_clipboard(_zip_path: &Path) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::build_zip;
    use std::fs;

    // build_zip é a única parte verificável sem GUI: confere que o zip leva a pasta-raiz como
    // prefixo e inclui arquivos aninhados (a lógica de prefixo/file_type que os tipos não pegam).
    #[test]
    fn build_zip_includes_root_folder_and_nested_files() {
        let src = std::env::temp_dir().join(format!("kw-test-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&src);
        fs::create_dir_all(src.join("sub")).unwrap();
        fs::write(src.join("index.md"), b"# oi").unwrap();
        fs::write(src.join("sub").join("note.md"), b"aninhado").unwrap();

        let zip_path = build_zip(&src).unwrap();
        let base = src.file_name().unwrap().to_string_lossy().to_string();

        let file = fs::File::open(&zip_path).unwrap();
        let archive = zip::ZipArchive::new(file).unwrap();
        let names: Vec<String> = archive.file_names().map(|s| s.to_string()).collect();

        assert!(names.iter().any(|n| n == &format!("{}/index.md", base)));
        assert!(names.iter().any(|n| n == &format!("{}/sub/note.md", base)));

        let _ = fs::remove_dir_all(&src);
        let _ = fs::remove_file(&zip_path);
    }
}
