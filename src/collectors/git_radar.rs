use std::path::{Path, PathBuf};
use std::process::Command;
use crate::types::{GitAccountSummary, GitHubAccountInfo, GitIdentityInfo, GitProjectInfo};

pub struct GitRadar;

impl GitRadar {
    pub fn scan_projects() -> Vec<GitProjectInfo> {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/wishlife".to_string());
        let search_roots = vec![
            PathBuf::from(&home).join("workspace"),
            PathBuf::from(&home).join("Projects"),
            PathBuf::from(&home).join("Code"),
            PathBuf::from(&home).join("Developer"),
            PathBuf::from(&home),
        ];

        let mut git_dirs = Vec::new();

        for root in search_roots {
            if root.exists() {
                Self::find_git_repos(&root, 0, 2, &mut git_dirs);
            }
        }

        git_dirs.sort();
        git_dirs.dedup();

        let mut results = Vec::new();
        for repo in git_dirs {
            if let Some(info) = Self::inspect_repo(&repo) {
                results.push(info);
            }
        }

        results
    }

    pub fn get_account_summary() -> GitAccountSummary {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/wishlife".to_string());
        let git_config_path = format!("{}/.gitconfig", home);

        // 1. Git Global Configuration
        let user_name = Self::get_git_config("user.name");
        let user_email = Self::get_git_config("user.email");
        let signing_key = Self::get_git_config("user.signingkey");
        let editor = Self::get_git_config("core.editor");
        let default_branch = Self::get_git_config("init.defaultBranch");
        let credential_helper = Self::get_git_config("credential.helper");

        let git = GitIdentityInfo {
            user_name,
            user_email,
            signing_key,
            editor,
            default_branch,
            credential_helper,
            config_path: git_config_path,
        };

        // 2. GitHub Account (via gh CLI and hosts.yml)
        let github = Self::get_github_account(&home);

        GitAccountSummary { git, github }
    }

    fn get_git_config(key: &str) -> Option<String> {
        let out = Command::new("git")
            .args(["config", "--global", key])
            .output()
            .ok()?;

        if out.status.success() {
            let val = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !val.is_empty() {
                return Some(val);
            }
        }
        None
    }

    fn get_github_account(home: &str) -> Option<GitHubAccountInfo> {
        let gh_hosts_file = PathBuf::from(home).join(".config/gh/hosts.yml");
        let mut user_from_file = None;
        let mut proto_from_file = "ssh".to_string();
        let mut host = "github.com".to_string();

        if gh_hosts_file.exists() {
            if let Ok(content) = std::fs::read_to_string(&gh_hosts_file) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("user:") {
                        let u = trimmed.trim_start_matches("user:").trim().to_string();
                        if !u.is_empty() {
                            user_from_file = Some(u);
                        }
                    } else if trimmed.starts_with("git_protocol:") {
                        let p = trimmed.trim_start_matches("git_protocol:").trim().to_string();
                        if !p.is_empty() {
                            proto_from_file = p;
                        }
                    } else if trimmed.ends_with(':') && !trimmed.starts_with("users:") {
                        let h = trimmed.trim_end_matches(':').trim().to_string();
                        if h.contains('.') {
                            host = h;
                        }
                    }
                }
            }
        }

        // Check gh auth status CLI
        let gh_status_out = Command::new("gh")
            .args(["auth", "status"])
            .output()
            .ok();

        let (is_authenticated, status_text, detected_user) = match gh_status_out {
            Some(out) => {
                let combined = format!(
                    "{}\n{}",
                    String::from_utf8_lossy(&out.stdout),
                    String::from_utf8_lossy(&out.stderr)
                );

                let mut parsed_user = None;
                for line in combined.lines() {
                    if line.contains("account") {
                        if let Some(pos) = line.find("account") {
                            let part = &line[pos + 7..].trim();
                            let u = part.split_whitespace().next().unwrap_or("").to_string();
                            if !u.is_empty() {
                                parsed_user = Some(u);
                            }
                        }
                    }
                }

                if combined.contains("Logged in to") && !combined.contains("Failed to log in") {
                    (true, "Active · 已登录".to_string(), parsed_user)
                } else if combined.contains("Failed to log in") || combined.contains("invalid") {
                    (false, "Token Expired · 需重新认证".to_string(), parsed_user)
                } else if combined.contains("not logged in") {
                    (false, "未登录".to_string(), None)
                } else {
                    (
                        user_from_file.is_some(),
                        "Configured · 已配置".to_string(),
                        parsed_user,
                    )
                }
            }
            None => (
                user_from_file.is_some(),
                if user_from_file.is_some() {
                    "Configured via hosts.yml".to_string()
                } else {
                    "gh CLI 未安装或未登录".to_string()
                },
                None,
            ),
        };

        let username = detected_user.or(user_from_file);

        if username.is_none() && !is_authenticated {
            return None;
        }

        Some(GitHubAccountInfo {
            username,
            host,
            git_protocol: proto_from_file,
            is_authenticated,
            status_text,
        })
    }

    fn find_git_repos(dir: &Path, depth: usize, max_depth: usize, results: &mut Vec<PathBuf>) {
        if depth > max_depth {
            return;
        }

        if dir.join(".git").exists() {
            results.push(dir.to_path_buf());
            return;
        }

        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                let file_name = entry.file_name();
                let name = file_name.to_string_lossy();

                if name.starts_with('.') || name == "node_modules" || name == "target" || name == "Library" || name == "dist" {
                    continue;
                }

                if p.is_dir() {
                    Self::find_git_repos(&p, depth + 1, max_depth, results);
                }
            }
        }
    }

    fn inspect_repo(repo_path: &Path) -> Option<GitProjectInfo> {
        let name = repo_path.file_name()?.to_string_lossy().to_string();
        let path_str = repo_path.to_string_lossy().to_string();

        // 1. Current branch
        let branch_out = Command::new("git")
            .current_dir(repo_path)
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .output()
            .ok()?;
        let branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();

        // 2. Status / Dirty check
        let status_out = Command::new("git")
            .current_dir(repo_path)
            .args(["status", "--porcelain"])
            .output()
            .ok();
        let (is_dirty, uncommitted_count) = match status_out {
            Some(out) => {
                let text = String::from_utf8_lossy(&out.stdout);
                let count = text.lines().filter(|l| !l.trim().is_empty()).count();
                (count > 0, count)
            }
            None => (false, 0),
        };

        // 3. Ahead / Behind count
        let (ahead, behind) = Self::get_ahead_behind(repo_path);

        // 4. Last commit details
        let log_out = Command::new("git")
            .current_dir(repo_path)
            .args(["log", "-1", "--format=%an|%cr|%s"])
            .output()
            .ok();

        let (author, time, msg) = match log_out {
            Some(out) => {
                let text = String::from_utf8_lossy(&out.stdout);
                let parts: Vec<&str> = text.trim().split('|').collect();
                if parts.len() >= 3 {
                    (parts[0].to_string(), parts[1].to_string(), parts[2].to_string())
                } else {
                    ("-".to_string(), "-".to_string(), "-".to_string())
                }
            }
            None => ("-".to_string(), "-".to_string(), "-".to_string()),
        };

        Some(GitProjectInfo {
            name,
            path: path_str,
            branch: if branch.is_empty() { "HEAD".to_string() } else { branch },
            is_dirty,
            uncommitted_count,
            ahead,
            behind,
            last_commit_msg: msg,
            last_commit_author: author,
            last_commit_time: time,
        })
    }

    fn get_ahead_behind(repo_path: &Path) -> (usize, usize) {
        if let Ok(out) = Command::new("git")
            .current_dir(repo_path)
            .args(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            let parts: Vec<&str> = text.trim().split_whitespace().collect();
            if parts.len() == 2 {
                let behind = parts[0].parse::<usize>().unwrap_or(0);
                let ahead = parts[1].parse::<usize>().unwrap_or(0);
                return (ahead, behind);
            }
        }
        (0, 0)
    }
}
