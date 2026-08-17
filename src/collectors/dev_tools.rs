use std::process::Command;
use crate::types::DevToolInfo;

pub struct DevToolsCollector;

impl DevToolsCollector {
    pub fn new() -> Self {
        Self
    }

    pub fn collect(&self) -> Vec<DevToolInfo> {
        let tools = vec![
            ("Node.js", "Runtime", "node", vec!["-v"]),
            ("npm", "Package Manager", "npm", vec!["-v"]),
            ("pnpm", "Package Manager", "pnpm", vec!["-v"]),
            ("Bun", "Runtime", "bun", vec!["-v"]),
            ("Rust (rustc)", "Compiler", "rustc", vec!["--version"]),
            ("Cargo", "Build Tool", "cargo", vec!["--version"]),
            ("Go", "Runtime", "go", vec!["version"]),
            ("Python 3", "Runtime", "python3", vec!["--version"]),
            ("Git", "VCS", "git", vec!["--version"]),
            ("Docker", "Container Engine", "docker", vec!["--version"]),
            ("Homebrew", "Package Manager", "brew", vec!["--version"]),
        ];

        let mut results = Vec::new();

        for (name, category, bin, args) in tools {
            let path_output = Command::new("which").arg(bin).output();
            let bin_path = match path_output {
                Ok(out) if out.status.success() => {
                    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
                }
                _ => None,
            };

            let is_installed = bin_path.is_some();
            let mut version = None;

            if is_installed {
                if let Ok(ver_out) = Command::new(bin).args(&args).output() {
                    if ver_out.status.success() {
                        let raw = String::from_utf8_lossy(&ver_out.stdout);
                        let first_line = raw.lines().next().unwrap_or("").trim();
                        version = Some(clean_version_string(first_line));
                    }
                }
            }

            results.push(DevToolInfo {
                name: name.to_string(),
                category: category.to_string(),
                version,
                path: bin_path,
                is_installed,
            });
        }

        results
    }
}

fn clean_version_string(raw: &str) -> String {
    let r = raw.trim();
    if r.len() > 60 {
        format!("{}...", &r[..57])
    } else {
        r.to_string()
    }
}
