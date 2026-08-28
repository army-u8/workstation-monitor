use crate::types::DevToolInfo;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct DevToolsCollector;

struct ToolSpec {
    name: &'static str,
    category: &'static str,
    binary_names: &'static [&'static str],
    version_args: &'static [&'static str],
}

impl DevToolsCollector {
    pub fn new() -> Self {
        Self
    }

    /// Build a comprehensive list of candidate search directories on macOS
    fn get_search_paths() -> Vec<PathBuf> {
        let mut dirs: Vec<PathBuf> = Vec::new();
        let mut seen = HashSet::new();

        let mut push_dir = |p: PathBuf| {
            if !seen.contains(&p) {
                seen.insert(p.clone());
                dirs.push(p);
            }
        };

        // 1. Process environment PATH
        if let Ok(path_var) = std::env::var("PATH") {
            for part in std::env::split_paths(&path_var) {
                push_dir(part);
            }
        }

        // 2. User HOME-relative developer directories
        if let Ok(home) = std::env::var("HOME") {
            let home_path = Path::new(&home);

            // Rustup toolchain bin directories
            let rustup_dir = home_path.join(".rustup").join("toolchains");
            if let Ok(entries) = std::fs::read_dir(&rustup_dir) {
                for entry in entries.flatten() {
                    let bin_dir = entry.path().join("bin");
                    if bin_dir.is_dir() {
                        push_dir(bin_dir);
                    }
                }
            }

            // NVM Node.js versions
            let nvm_versions = home_path.join(".nvm").join("versions").join("node");
            if let Ok(entries) = std::fs::read_dir(&nvm_versions) {
                let mut nvm_bins: Vec<PathBuf> = Vec::new();
                for entry in entries.flatten() {
                    let bin_dir = entry.path().join("bin");
                    if bin_dir.is_dir() {
                        nvm_bins.push(bin_dir);
                    }
                }
                nvm_bins.sort_by(|a, b| b.cmp(a));
                for b in nvm_bins {
                    push_dir(b);
                }
            }

            // FNM current / default
            push_dir(home_path.join(".fnm").join("current").join("bin"));
            push_dir(home_path.join(".fnm").join("aliases").join("default").join("bin"));

            // Volta
            push_dir(home_path.join(".volta").join("bin"));

            // Cargo
            push_dir(home_path.join(".cargo").join("bin"));

            // Bun
            push_dir(home_path.join(".bun").join("bin"));

            // Deno
            push_dir(home_path.join(".deno").join("bin"));

            // Local & user bin
            push_dir(home_path.join(".local").join("bin"));
            push_dir(home_path.join("bin"));
            push_dir(home_path.join("go").join("bin"));

            // ASDF, Pyenv, Rbenv
            push_dir(home_path.join(".asdf").join("shims"));
            push_dir(home_path.join(".asdf").join("bin"));
            push_dir(home_path.join(".pyenv").join("shims"));
            push_dir(home_path.join(".pyenv").join("bin"));
            push_dir(home_path.join(".rbenv").join("shims"));
            push_dir(home_path.join(".rbenv").join("bin"));

            // Custom Homebrew & Vite-plus paths
            push_dir(home_path.join("projects").join("homebrew").join("Homebrew").join("bin"));
            push_dir(home_path.join(".vite-plus").join("bin"));
        }

        // 3. System-wide standard paths on macOS & Linux
        push_dir(PathBuf::from("/opt/homebrew/bin"));
        push_dir(PathBuf::from("/opt/homebrew/sbin"));
        push_dir(PathBuf::from("/usr/local/bin"));
        push_dir(PathBuf::from("/usr/local/sbin"));
        push_dir(PathBuf::from("/usr/local/go/bin"));
        push_dir(PathBuf::from("/Applications/Docker.app/Contents/Resources/bin"));
        push_dir(PathBuf::from("/Applications/Ollama.app/Contents/Resources"));
        push_dir(PathBuf::from("/usr/bin"));
        push_dir(PathBuf::from("/bin"));
        push_dir(PathBuf::from("/usr/sbin"));
        push_dir(PathBuf::from("/sbin"));

        dirs
    }

    /// Resolve absolute executable path for a given binary name
    fn find_binary(bin_names: &[&str], search_paths: &[PathBuf]) -> Option<PathBuf> {
        for bin in bin_names {
            for dir in search_paths {
                let candidate = dir.join(bin);
                if candidate.is_file() {
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        if let Ok(meta) = candidate.metadata() {
                            if meta.permissions().mode() & 0o111 != 0 {
                                return Some(candidate);
                            }
                        }
                    }
                    #[cfg(not(unix))]
                    {
                        return Some(candidate);
                    }
                }
            }

            // Fallback to which
            if let Ok(out) = Command::new("which").arg(bin).output() {
                if out.status.success() {
                    let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    let path = PathBuf::from(p);
                    if path.is_file() {
                        return Some(path);
                    }
                }
            }
        }
        None
    }

    /// Execute binary to get version string
    fn probe_version(bin_path: &Path, args: &[&str]) -> Option<String> {
        let output = Command::new(bin_path).args(args).output().ok()?;

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{}\n{}", stdout_str, stderr_str);

        // Filter out macOS shim stub messages (e.g. /usr/bin/java when no JDK installed)
        if combined.contains("Unable to locate a Java Runtime")
            || combined.contains("xcode-select --install")
            || combined.contains("No Java runtime present")
        {
            return None;
        }

        let first_meaningful_line = combined
            .lines()
            .map(|l| l.trim())
            .find(|l| !l.is_empty())?;

        Some(clean_version_string(first_meaningful_line))
    }

    pub fn collect(&self) -> Vec<DevToolInfo> {
        let search_paths = Self::get_search_paths();

        let tool_specs: &[ToolSpec] = &[
            // Runtimes & Compilers
            ToolSpec {
                name: "Node.js",
                category: "Runtime",
                binary_names: &["node"],
                version_args: &["-v"],
            },
            ToolSpec {
                name: "Bun",
                category: "Runtime",
                binary_names: &["bun"],
                version_args: &["-v"],
            },
            ToolSpec {
                name: "Deno",
                category: "Runtime",
                binary_names: &["deno"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Rust (rustc)",
                category: "Compiler",
                binary_names: &["rustc"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Cargo",
                category: "Build Tool",
                binary_names: &["cargo"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Go",
                category: "Runtime",
                binary_names: &["go"],
                version_args: &["version"],
            },
            ToolSpec {
                name: "Python 3",
                category: "Runtime",
                binary_names: &["python3", "python"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Java",
                category: "Runtime",
                binary_names: &["java"],
                version_args: &["-version"],
            },
            ToolSpec {
                name: "Swift",
                category: "Compiler",
                binary_names: &["swift"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Clang",
                category: "Compiler",
                binary_names: &["clang"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "GCC",
                category: "Compiler",
                binary_names: &["gcc"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "PHP",
                category: "Runtime",
                binary_names: &["php"],
                version_args: &["-v"],
            },
            ToolSpec {
                name: "Ruby",
                category: "Runtime",
                binary_names: &["ruby"],
                version_args: &["-v"],
            },
            ToolSpec {
                name: "Zig",
                category: "Compiler",
                binary_names: &["zig"],
                version_args: &["version"],
            },
            // Package Managers
            ToolSpec {
                name: "Homebrew",
                category: "Package Manager",
                binary_names: &["brew"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "npm",
                category: "Package Manager",
                binary_names: &["npm"],
                version_args: &["-v"],
            },
            ToolSpec {
                name: "pnpm",
                category: "Package Manager",
                binary_names: &["pnpm"],
                version_args: &["-v"],
            },
            ToolSpec {
                name: "yarn",
                category: "Package Manager",
                binary_names: &["yarn"],
                version_args: &["-v"],
            },
            ToolSpec {
                name: "uv",
                category: "Package Manager",
                binary_names: &["uv"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "pip3",
                category: "Package Manager",
                binary_names: &["pip3", "pip"],
                version_args: &["--version"],
            },
            // AI & DevOps & Cloud
            ToolSpec {
                name: "Ollama",
                category: "AI Runtime",
                binary_names: &["ollama"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Docker",
                category: "Container Engine",
                binary_names: &["docker"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Podman",
                category: "Container Engine",
                binary_names: &["podman"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "GitHub CLI",
                category: "CLI Tool",
                binary_names: &["gh"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Kubectl",
                category: "DevOps",
                binary_names: &["kubectl"],
                version_args: &["version", "--client"],
            },
            ToolSpec {
                name: "Terraform",
                category: "DevOps",
                binary_names: &["terraform"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "AWS CLI",
                category: "Cloud CLI",
                binary_names: &["aws"],
                version_args: &["--version"],
            },
            // VCS & Core Utilities
            ToolSpec {
                name: "Git",
                category: "VCS",
                binary_names: &["git"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "Neovim",
                category: "Editor",
                binary_names: &["nvim"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "tmux",
                category: "Terminal",
                binary_names: &["tmux"],
                version_args: &["-V"],
            },
            ToolSpec {
                name: "ripgrep",
                category: "Search Tool",
                binary_names: &["rg"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "jq",
                category: "JSON Tool",
                binary_names: &["jq"],
                version_args: &["--version"],
            },
            ToolSpec {
                name: "ffmpeg",
                category: "Media Tool",
                binary_names: &["ffmpeg"],
                version_args: &["-version"],
            },
        ];

        let mut results = Vec::new();

        for spec in tool_specs {
            let bin_path = Self::find_binary(spec.binary_names, &search_paths);
            let is_installed = bin_path.is_some();
            let mut version = None;

            if let Some(ref path) = bin_path {
                version = Self::probe_version(path, spec.version_args);
            }

            // If Java was a stub shim with no real runtime installed, treat as not installed
            let (final_installed, final_path) =
                if is_installed && (spec.name == "Java" && version.is_none()) {
                    (false, None)
                } else {
                    (is_installed, bin_path.map(|p| p.to_string_lossy().to_string()))
                };

            results.push(DevToolInfo {
                name: spec.name.to_string(),
                category: spec.category.to_string(),
                version,
                path: final_path,
                is_installed: final_installed,
            });
        }

        results
    }
}

pub fn clean_version_string(raw: &str) -> String {
    let r = raw.trim();

    // 1. Direct semver string: e.g. "v22.4.1"
    if let Some(stripped) = r.strip_prefix('v') {
        if stripped.chars().next().map_or(false, |c| c.is_ascii_digit()) {
            let ver_token = stripped.split_whitespace().next().unwrap_or(stripped);
            let clean = ver_token.trim_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '-');
            if !clean.is_empty() {
                return format!("v{}", clean);
            }
        }
    }

    // 2. Extract standard semver like X.Y.Z or X.Y from command outputs:
    // e.g. "rustc 1.97.1 (8bab26f4f 2026-07-14)" -> "v1.97.1"
    // e.g. "go version go1.25.7 darwin/arm64" -> "v1.25.7"
    // e.g. "Python 3.14.3" -> "v3.14.3"
    // e.g. "Homebrew 6.0.17" -> "v6.0.17"
    // e.g. "git version 2.52.0" -> "v2.52.0"
    for token in r.split(|c: char| c.is_whitespace() || c == ',' || c == '"' || c == '(' || c == ')' || c == ':') {
        let clean_tok = token.trim_start_matches(|c: char| !c.is_ascii_digit() && c != 'v');
        let semver_candidate = if let Some(s) = clean_tok.strip_prefix('v') { s } else { clean_tok };
        let parts: Vec<&str> = semver_candidate.split('.').collect();
        if parts.len() >= 2
            && !parts[0].is_empty()
            && parts[0].chars().all(|c| c.is_ascii_digit())
            && !parts[1].is_empty()
            && parts[1].chars().all(|c| c.is_ascii_digit())
        {
            let end_clean = semver_candidate.trim_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '-');
            if !end_clean.is_empty() {
                return format!("v{}", end_clean);
            }
        }
    }

    if r.len() > 35 {
        format!("{}...", &r[..32])
    } else {
        r.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_version_string() {
        assert_eq!(clean_version_string("v24.11.1"), "v24.11.1");
        assert_eq!(clean_version_string("11.6.2"), "v11.6.2");
        assert_eq!(clean_version_string("rustc 1.97.1 (8bab26f4f 2026-07-14)"), "v1.97.1");
        assert_eq!(clean_version_string("cargo 1.97.1 (c980f4866 2026-06-30)"), "v1.97.1");
        assert_eq!(clean_version_string("go version go1.25.7 darwin/arm64"), "v1.25.7");
        assert_eq!(clean_version_string("Python 3.14.3"), "v3.14.3");
        assert_eq!(clean_version_string("git version 2.52.0"), "v2.52.0");
        assert_eq!(clean_version_string("Homebrew 6.0.17"), "v6.0.17");
        assert_eq!(clean_version_string("Docker version 29.1.3, build f52814d"), "v29.1.3");
        assert_eq!(clean_version_string("uv 0.10.7 (08ab1a344 2026-02-27)"), "v0.10.7");
        assert_eq!(clean_version_string("gh version 2.97.0 (2026-07-31)"), "v2.97.0");
        assert_eq!(clean_version_string("deno 2.6.8 (stable, release, aarch64-apple-darwin)"), "v2.6.8");
        assert_eq!(clean_version_string("Apple Swift version 6.2.4 (swiftlang-6.2.4.1.4)"), "v6.2.4");
        assert_eq!(clean_version_string("Apple clang version 17.0.0 (clang-1700.6.4.2)"), "v17.0.0");
        assert_eq!(clean_version_string("openjdk version \"21.0.2\" 2024-01-16"), "v21.0.2");
        assert_eq!(clean_version_string("ollama version is 0.3.4"), "v0.3.4");
    }

    #[test]
    fn test_dev_tools_collector_runs() {
        let collector = DevToolsCollector::new();
        let tools = collector.collect();
        assert!(!tools.is_empty());
        for t in &tools {
            if t.is_installed {
                println!("  ✅ {:15} | {:10} | {:35} | {}", t.name, t.version.as_deref().unwrap_or(""), t.path.as_deref().unwrap_or(""), t.category);
            } else {
                println!("  ❌ {:15} | (not installed)", t.name);
            }
        }
        let git_tool = tools.iter().find(|t| t.name == "Git");
        assert!(git_tool.is_some());
    }
}

