use axum::{
    body::Body,
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;
use std::fs;
use std::io::Read;
use std::path::{Component, Path};

#[cfg(unix)]
use std::ffi::CString;
#[cfg(unix)]
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
#[cfg(unix)]
use std::os::unix::ffi::OsStrExt;

#[derive(RustEmbed)]
#[folder = "frontend/dist/"]
pub struct WebAssets;

#[cfg(unix)]
fn open_directory_at(parent_fd: i32, name: &std::ffi::OsStr) -> std::io::Result<OwnedFd> {
    let name = CString::new(name.as_bytes())
        .map_err(|_| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
    let fd = unsafe {
        libc::openat(
            parent_fd,
            name.as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    if fd == -1 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(unsafe { OwnedFd::from_raw_fd(fd) })
    }
}

#[cfg(unix)]
fn read_local_asset(root: &Path, relative: &Path) -> std::io::Result<Vec<u8>> {
    let root = CString::new(root.as_os_str().as_bytes())
        .map_err(|_| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
    let root_fd = unsafe {
        libc::open(
            root.as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    if root_fd == -1 {
        return Err(std::io::Error::last_os_error());
    }
    let root_fd = unsafe { OwnedFd::from_raw_fd(root_fd) };
    let components = relative
        .components()
        .map(|component| match component {
            Component::Normal(name) => Ok(name),
            _ => Err(std::io::Error::from(std::io::ErrorKind::InvalidInput)),
        })
        .collect::<std::io::Result<Vec<_>>>()?;
    let (file_name, directories) = components
        .split_last()
        .ok_or_else(|| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;

    let mut current_directory = None;
    for directory in directories {
        let parent_fd = current_directory
            .as_ref()
            .map(AsRawFd::as_raw_fd)
            .unwrap_or_else(|| root_fd.as_raw_fd());
        current_directory = Some(open_directory_at(parent_fd, directory)?);
    }
    let parent_fd = current_directory
        .as_ref()
        .map(AsRawFd::as_raw_fd)
        .unwrap_or_else(|| root_fd.as_raw_fd());
    let file_name = CString::new(file_name.as_bytes())
        .map_err(|_| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
    let file_fd = unsafe {
        libc::openat(
            parent_fd,
            file_name.as_ptr(),
            libc::O_RDONLY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    if file_fd == -1 {
        return Err(std::io::Error::last_os_error());
    }

    let mut file = unsafe { fs::File::from_raw_fd(file_fd) };
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    Ok(bytes)
}

#[cfg(not(unix))]
fn read_local_asset(root: &Path, relative: &Path) -> std::io::Result<Vec<u8>> {
    let canonical_root = fs::canonicalize(root)?;
    let canonical_file = fs::canonicalize(canonical_root.join(relative))?;
    if !canonical_file.starts_with(&canonical_root) {
        return Err(std::io::Error::from(std::io::ErrorKind::PermissionDenied));
    }
    fs::read(canonical_file)
}

pub async fn static_handler(uri: Uri) -> impl IntoResponse {
    let raw_path = uri.path();

    // If an API route reaches static_handler, return a 404 JSON error instead of index.html
    if raw_path.starts_with("/api/") {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json"),
            )
            .body(Body::from(r#"{"error":"API endpoint not found"}"#))
            .unwrap();
    }

    let mut path = raw_path.trim_start_matches('/').to_string();
    if path.is_empty() {
        path = "index.html".to_string();
    }
    let is_safe_asset_path = Path::new(&path)
        .components()
        .all(|component| matches!(component, Component::Normal(_)));

    // 1. Check local filesystem first (frontend/dist/) for instant hot reloading without restarting Rust
    let local_root = Path::new("frontend/dist");
    let local_file = Path::new(&path);
    let local_asset = is_safe_asset_path.then(|| read_local_asset(local_root, local_file));
    if let Some(Ok(bytes)) = local_asset.as_ref() {
        let mime = mime_guess::from_path(local_file).first_or_octet_stream();
        return Response::builder()
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_str(mime.as_ref())
                    .unwrap_or(HeaderValue::from_static("application/octet-stream")),
            )
            .header(
                header::CACHE_CONTROL,
                HeaderValue::from_static("no-cache, no-store, must-revalidate"),
            )
            .body(Body::from(bytes.clone()))
            .unwrap();
    }

    // 2. Fallback to embedded assets from rust-embed (for standalone single-binary release)
    let local_asset_missing = matches!(
        local_asset,
        Some(Err(ref error)) if error.kind() == std::io::ErrorKind::NotFound
    );
    if is_safe_asset_path && local_asset_missing {
        if let Some(content) = WebAssets::get(&path) {
            let mime = mime_guess::from_path(&path).first_or_octet_stream();
            return Response::builder()
                .header(
                    header::CONTENT_TYPE,
                    HeaderValue::from_str(mime.as_ref())
                        .unwrap_or(HeaderValue::from_static("application/octet-stream")),
                )
                .body(Body::from(content.data))
                .unwrap();
        }
    }

    // 3. Fallback for SPA Routing: serve index.html (Only for non-API page routes)
    let local_index = Path::new("index.html");
    let local_index_result = read_local_asset(local_root, local_index);
    if let Ok(bytes) = local_index_result.as_ref() {
        return Response::builder()
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/html; charset=utf-8"),
            )
            .header(
                header::CACHE_CONTROL,
                HeaderValue::from_static("no-cache, no-store, must-revalidate"),
            )
            .body(Body::from(bytes.clone()))
            .unwrap();
    }

    let local_index_missing = local_index_result
        .as_ref()
        .is_err_and(|error| error.kind() == std::io::ErrorKind::NotFound);
    if local_index_missing {
        if let Some(content) = WebAssets::get("index.html") {
            return Response::builder()
                .header(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("text/html; charset=utf-8"),
                )
                .body(Body::from(content.data))
                .unwrap();
        }
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"))
        .body(Body::from(
            "<html><body style='background:#070a10;color:#fff;font-family:sans-serif;padding:40px;'><h2>⚠️ 404: 页面资源未找到</h2><p>请先在 <code>frontend/</code> 目录下执行 <code>npm run build</code> 生成前端静态文件。</p></body></html>",
        ))
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    struct TestFiles(Vec<std::path::PathBuf>);

    #[cfg(unix)]
    impl Drop for TestFiles {
        fn drop(&mut self) {
            for path in &self.0 {
                let _ = std::fs::remove_file(path);
            }
        }
    }

    #[tokio::test]
    async fn static_handler_does_not_serve_files_outside_frontend_dist() {
        let response = static_handler(Uri::from_static("/../../Cargo.toml"))
            .await
            .into_response();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let text = String::from_utf8_lossy(&body);

        assert!(!text.contains("name = \"workstation-monitor\""));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn static_handler_does_not_follow_asset_symlinks_outside_frontend_dist() {
        use std::os::unix::fs::symlink;

        let unique = format!(
            "embedded-symlink-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let outside = std::env::temp_dir().join(format!("{unique}.txt"));
        let link = Path::new("frontend/dist").join(format!("{unique}.txt"));
        fs::write(&outside, b"VIBEDESK_OUTSIDE_STATIC_SECRET").unwrap();
        symlink(&outside, &link).unwrap();
        let _cleanup = TestFiles(vec![link, outside]);

        let direct_read = read_local_asset(
            Path::new("frontend/dist"),
            Path::new(&format!("{unique}.txt")),
        );
        assert!(
            direct_read.is_err(),
            "secure local read followed symlink: {direct_read:?}"
        );

        let uri: Uri = format!("/{unique}.txt").parse().unwrap();
        let response = static_handler(uri).await.into_response();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();

        assert!(
            !body
                .windows(b"VIBEDESK_OUTSIDE_STATIC_SECRET".len())
                .any(|window| window == b"VIBEDESK_OUTSIDE_STATIC_SECRET"),
            "unexpected body: {}",
            String::from_utf8_lossy(&body)
        );
    }
}
