use rust_embed::RustEmbed;
use axum::{
    body::Body,
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use std::fs;
use std::path::Path;

#[derive(RustEmbed)]
#[folder = "frontend/dist/"]
pub struct WebAssets;

pub async fn static_handler(uri: Uri) -> impl IntoResponse {
    let raw_path = uri.path();

    // If an API route reaches static_handler, return a 404 JSON error instead of index.html
    if raw_path.starts_with("/api/") {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, HeaderValue::from_static("application/json"))
            .body(Body::from(r#"{"error":"API endpoint not found"}"#))
            .unwrap();
    }

    let mut path = raw_path.trim_start_matches('/').to_string();
    if path.is_empty() {
        path = "index.html".to_string();
    }

    // 1. Try embedded assets from rust-embed
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

    // 2. Fallback to reading directly from local filesystem (frontend/dist/)
    let local_file = Path::new("frontend/dist").join(&path);
    if local_file.is_file() {
        if let Ok(bytes) = fs::read(&local_file) {
            let mime = mime_guess::from_path(&local_file).first_or_octet_stream();
            return Response::builder()
                .header(
                    header::CONTENT_TYPE,
                    HeaderValue::from_str(mime.as_ref())
                        .unwrap_or(HeaderValue::from_static("application/octet-stream")),
                )
                .body(Body::from(bytes))
                .unwrap();
        }
    }

    // 3. Fallback for SPA Routing: serve index.html (Only for non-API page routes)
    if let Some(content) = WebAssets::get("index.html") {
        return Response::builder()
            .header(header::CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"))
            .body(Body::from(content.data))
            .unwrap();
    }

    let local_index = Path::new("frontend/dist/index.html");
    if local_index.is_file() {
        if let Ok(bytes) = fs::read(local_index) {
            return Response::builder()
                .header(header::CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"))
                .body(Body::from(bytes))
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
