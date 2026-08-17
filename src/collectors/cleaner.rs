use std::path::{Path, PathBuf};
use std::process::Command;
use crate::types::CleanerItem;

pub struct SystemCleaner;

impl SystemCleaner {
    pub fn scan() -> Vec<CleanerItem> {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/wishlife".to_string());
        let home_path = Path::new(&home);

        let targets = vec![
            (
                "xcode_derived_data",
                "Xcode DerivedData 编译缓存",
                "Developer",
                home_path.join("Library/Developer/Xcode/DerivedData"),
            ),
            (
                "homebrew_cache",
                "Homebrew 下载与安装包缓存",
                "Package Manager",
                home_path.join("Library/Caches/Homebrew"),
            ),
            (
                "npm_cache",
                "NPM 全局依赖缓存",
                "JavaScript",
                home_path.join(".npm"),
            ),
            (
                "yarn_cache",
                "Yarn 全局依赖缓存",
                "JavaScript",
                home_path.join("Library/Caches/Yarn"),
            ),
            (
                "pnpm_cache",
                "PNPM Store 全局存储",
                "JavaScript",
                home_path.join("Library/pnpm/store"),
            ),
            (
                "cargo_cache",
                "Rust Cargo Registry 源码缓存",
                "Rust",
                home_path.join(".cargo/registry/cache"),
            ),
            (
                "user_logs",
                "macOS 用户诊断与崩溃日志",
                "System",
                home_path.join("Library/Logs"),
            ),
            (
                "user_caches",
                "macOS 应用临时缓存目录",
                "System",
                home_path.join("Library/Caches"),
            ),
        ];

        let mut items = Vec::new();

        for (id, name, cat, path) in targets {
            if path.exists() {
                let size = Self::dir_size(&path);
                items.push(CleanerItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    category: cat.to_string(),
                    path: Some(path.to_string_lossy().to_string()),
                    size_bytes: size,
                    size_human: Self::format_bytes(size),
                    is_cleanable: size > 0,
                });
            }
        }

        // Check Docker if running
        if let Ok(out) = Command::new("docker").args(["system", "df", "--format", "{{.Size}}"]).output() {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                items.push(CleanerItem {
                    id: "docker_cache".to_string(),
                    name: "Docker 未使用镜像与构建缓存".to_string(),
                    category: "Containers".to_string(),
                    path: Some("docker system prune".to_string()),
                    size_bytes: 0,
                    size_human: text.lines().next().unwrap_or("可清理").trim().to_string(),
                    is_cleanable: true,
                });
            }
        }

        items
    }

    pub fn clean(id: &str) -> Result<String, String> {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/wishlife".to_string());
        let home_path = Path::new(&home);

        match id {
            "xcode_derived_data" => {
                let p = home_path.join("Library/Developer/Xcode/DerivedData");
                Self::remove_dir_contents(&p)?;
                Ok("Xcode DerivedData 缓存已清空".to_string())
            }
            "homebrew_cache" => {
                let _ = Command::new("brew").args(["cleanup", "--prune=all", "-s"]).output();
                let p = home_path.join("Library/Caches/Homebrew");
                Self::remove_dir_contents(&p)?;
                Ok("Homebrew 缓存与旧版本包已清空".to_string())
            }
            "npm_cache" => {
                let _ = Command::new("npm").args(["cache", "clean", "--force"]).output();
                let p = home_path.join(".npm/_cacache");
                let _ = Self::remove_dir_contents(&p);
                Ok("NPM 缓存已清理".to_string())
            }
            "yarn_cache" => {
                let _ = Command::new("yarn").args(["cache", "clean"]).output();
                let p = home_path.join("Library/Caches/Yarn");
                let _ = Self::remove_dir_contents(&p);
                Ok("Yarn 缓存已清理".to_string())
            }
            "cargo_cache" => {
                let p = home_path.join(".cargo/registry/cache");
                Self::remove_dir_contents(&p)?;
                Ok("Cargo Registry 缓存已清理".to_string())
            }
            "user_logs" => {
                let p = home_path.join("Library/Logs");
                Self::remove_dir_contents(&p)?;
                Ok("用户日志已清理".to_string())
            }
            "docker_cache" => {
                let out = Command::new("docker")
                    .args(["system", "prune", "-f"])
                    .output()
                    .map_err(|e| format!("执行 docker prune 失败: {}", e))?;
                if out.status.success() {
                    Ok("Docker 缓存与无用容器已清理".to_string())
                } else {
                    Err(String::from_utf8_lossy(&out.stderr).to_string())
                }
            }
            _ => Err("未知的清理目标".to_string()),
        }
    }

    fn dir_size(path: &Path) -> u64 {
        if !path.exists() {
            return 0;
        }
        if path.is_file() {
            return path.metadata().map(|m| m.len()).unwrap_or(0);
        }

        let mut total = 0;
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    total += Self::dir_size(&p);
                } else {
                    total += entry.metadata().map(|m| m.len()).unwrap_or(0);
                }
            }
        }
        total
    }

    fn remove_dir_contents(path: &PathBuf) -> Result<(), String> {
        if !path.exists() {
            return Ok(());
        }
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let _ = std::fs::remove_dir_all(&p);
                } else {
                    let _ = std::fs::remove_file(&p);
                }
            }
        }
        Ok(())
    }

    fn format_bytes(bytes: u64) -> String {
        if bytes >= 1024 * 1024 * 1024 {
            format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
        } else if bytes >= 1024 * 1024 {
            format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
        } else if bytes >= 1024 {
            format!("{:.0} KB", bytes as f64 / 1024.0)
        } else {
            format!("{} B", bytes)
        }
    }
}
