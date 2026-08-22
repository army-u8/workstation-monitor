use crate::types::{GitAccountSummary, GitHubAccountInfo, GitIdentityInfo, GitProjectInfo};
use std::collections::HashSet;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

pub struct GitRadar;

impl GitRadar {
    const GIT_COMMAND_TIMEOUT: Duration = Duration::from_secs(3);
    const GH_COMMAND_TIMEOUT: Duration = Duration::from_secs(2);

    pub fn scan_projects() -> Vec<GitProjectInfo> {
        let Some(home) = std::env::var_os("HOME") else {
            tracing::warn!("Skipping Git radar scan because HOME is not set");
            return Vec::new();
        };
        let home = PathBuf::from(home);
        let search_roots = vec![
            home.join("workspace"),
            home.join("Projects"),
            home.join("Code"),
            home.join("Developer"),
            home,
        ];

        let mut git_dirs = Vec::new();
        let mut visited = HashSet::new();

        for root in search_roots {
            if root.exists() {
                Self::find_git_repos_once(&root, 0, 2, &mut visited, &mut git_dirs);
            }
        }

        git_dirs.sort();
        git_dirs.dedup();

        let workers = thread::available_parallelism()
            .map(|count| count.get())
            .unwrap_or(4)
            .min(8);
        Self::inspect_repositories_with(&git_dirs, workers, Self::inspect_repo)
    }

    pub fn get_account_summary() -> GitAccountSummary {
        let home = std::env::var_os("HOME").map(PathBuf::from);
        let git_config_path = home
            .as_ref()
            .map(|path| path.join(".gitconfig").to_string_lossy().to_string())
            .unwrap_or_else(|| "~/.gitconfig".to_string());

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
        let github = home
            .as_ref()
            .and_then(|path| Self::get_github_account(&path.to_string_lossy()));

        GitAccountSummary { git, github }
    }

    fn get_git_config(key: &str) -> Option<String> {
        let mut command = Command::new("git");
        command.args(["config", "--global", key]);
        let out = Self::run_command_with_timeout(&mut command, Self::GIT_COMMAND_TIMEOUT).ok()?;

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
                        let p = trimmed
                            .trim_start_matches("git_protocol:")
                            .trim()
                            .to_string();
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
        let mut gh_status = Command::new("gh");
        gh_status.args(["auth", "status"]);
        let gh_status_out =
            Self::run_command_with_timeout(&mut gh_status, Self::GH_COMMAND_TIMEOUT).ok();

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

    #[cfg(test)]
    fn find_git_repos(dir: &Path, depth: usize, max_depth: usize, results: &mut Vec<PathBuf>) {
        let mut visited = HashSet::new();
        Self::find_git_repos_once(dir, depth, max_depth, &mut visited, results);
    }

    fn find_git_repos_once(
        dir: &Path,
        depth: usize,
        max_depth: usize,
        visited: &mut HashSet<PathBuf>,
        results: &mut Vec<PathBuf>,
    ) {
        if depth > max_depth {
            return;
        }
        if !visited.insert(dir.to_path_buf()) {
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

                if name.starts_with('.')
                    || name == "node_modules"
                    || name == "target"
                    || name == "Library"
                    || name == "dist"
                {
                    continue;
                }

                let Ok(file_type) = entry.file_type() else {
                    continue;
                };
                if file_type.is_symlink() {
                    if p.join(".git").exists() {
                        results.push(p);
                    }
                    continue;
                }
                if file_type.is_dir() {
                    Self::find_git_repos_once(&p, depth + 1, max_depth, visited, results);
                }
            }
        }
    }

    fn inspect_repositories_with<F>(
        repositories: &[PathBuf],
        max_workers: usize,
        inspect: F,
    ) -> Vec<GitProjectInfo>
    where
        F: Fn(&Path) -> Option<GitProjectInfo> + Sync,
    {
        if repositories.is_empty() {
            return Vec::new();
        }
        let worker_count = max_workers.max(1).min(repositories.len());
        let chunk_size = repositories.len().div_ceil(worker_count);

        thread::scope(|scope| {
            let inspect = &inspect;
            repositories
                .chunks(chunk_size)
                .map(|chunk| {
                    scope.spawn(move || {
                        chunk
                            .iter()
                            .filter_map(|repository| inspect(repository))
                            .collect::<Vec<_>>()
                    })
                })
                .collect::<Vec<_>>()
                .into_iter()
                .filter_map(|worker| worker.join().ok())
                .flatten()
                .collect()
        })
    }

    fn inspect_repo(repo_path: &Path) -> Option<GitProjectInfo> {
        let name = repo_path.file_name()?.to_string_lossy().to_string();
        let path_str = repo_path.to_string_lossy().to_string();

        // 1. Current branch
        let mut branch_command = Command::new("git");
        branch_command
            .current_dir(repo_path)
            .args(["rev-parse", "--abbrev-ref", "HEAD"]);
        let branch = Self::run_command_with_timeout(&mut branch_command, Self::GIT_COMMAND_TIMEOUT)
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
            .filter(|branch| !branch.is_empty())
            .unwrap_or_else(|| "HEAD".to_string());

        // 2. Status / Dirty check
        let mut status_command = Command::new("git");
        status_command
            .current_dir(repo_path)
            .args(["status", "--porcelain"]);
        let status_out =
            Self::run_command_with_timeout(&mut status_command, Self::GIT_COMMAND_TIMEOUT);
        let (is_dirty, uncommitted_count, status_error) = Self::summarize_git_status(status_out);

        // 3. Ahead / Behind count
        let (ahead, behind) = Self::get_ahead_behind(repo_path);

        // 4. Last commit details
        let mut log_command = Command::new("git");
        log_command
            .current_dir(repo_path)
            .args(["log", "-1", "--format=%an|%cr|%s"]);
        let log_out = Self::run_command_with_timeout(&mut log_command, Self::GIT_COMMAND_TIMEOUT)
            .ok()
            .filter(|output| output.status.success());

        let (author, time, msg) = match log_out {
            Some(out) => {
                let text = String::from_utf8_lossy(&out.stdout);
                let parts: Vec<&str> = text.trim().split('|').collect();
                if parts.len() >= 3 {
                    (
                        parts[0].to_string(),
                        parts[1].to_string(),
                        parts[2].to_string(),
                    )
                } else {
                    ("-".to_string(), "-".to_string(), "-".to_string())
                }
            }
            None => ("-".to_string(), "-".to_string(), "-".to_string()),
        };

        Some(GitProjectInfo {
            name,
            path: path_str,
            branch,
            is_dirty,
            uncommitted_count,
            status_error,
            ahead,
            behind,
            last_commit_msg: msg,
            last_commit_author: author,
            last_commit_time: time,
        })
    }

    fn summarize_git_status(result: Result<Output, String>) -> (bool, usize, Option<String>) {
        match result {
            Ok(output) if output.status.success() => {
                let text = String::from_utf8_lossy(&output.stdout);
                let count = text.lines().filter(|line| !line.trim().is_empty()).count();
                (count > 0, count, None)
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let error = if stderr.is_empty() {
                    format!("git status failed with {}", output.status)
                } else {
                    format!("git status failed: {stderr}")
                };
                (false, 0, Some(error))
            }
            Err(error) => (false, 0, Some(error)),
        }
    }

    fn get_ahead_behind(repo_path: &Path) -> (usize, usize) {
        let mut command = Command::new("git");
        command.current_dir(repo_path).args([
            "rev-list",
            "--left-right",
            "--count",
            "@{upstream}...HEAD",
        ]);
        if let Ok(out) = Self::run_command_with_timeout(&mut command, Self::GIT_COMMAND_TIMEOUT) {
            if !out.status.success() {
                return (0, 0);
            }
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

    fn run_command_with_timeout(
        command: &mut Command,
        timeout: Duration,
    ) -> Result<Output, String> {
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        let mut child = command
            .spawn()
            .map_err(|error| format!("failed to start {:?}: {error}", command.get_program()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "failed to capture stdout".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "failed to capture stderr".to_string())?;
        let (stdout_tx, stdout_rx) = mpsc::channel();
        thread::spawn(move || {
            let mut bytes = Vec::new();
            let mut stream = stdout;
            let _ = stdout_tx.send(stream.read_to_end(&mut bytes).map(|_| bytes));
        });
        let (stderr_tx, stderr_rx) = mpsc::channel();
        thread::spawn(move || {
            let mut bytes = Vec::new();
            let mut stream = stderr;
            let _ = stderr_tx.send(stream.read_to_end(&mut bytes).map(|_| bytes));
        });
        let deadline = Instant::now() + timeout;

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    // A successful parent may leave descendants holding inherited output
                    // descriptors. Terminate the isolated group before draining output so a
                    // background grandchild cannot turn this bounded call into an infinite wait.
                    Self::terminate_command_group(&mut child);
                    let stdout = stdout_rx
                        .recv_timeout(Duration::from_secs(1))
                        .map_err(|_| "timed out draining command stdout".to_string())?
                        .map_err(|error| format!("failed to read stdout: {error}"))?;
                    let stderr = stderr_rx
                        .recv_timeout(Duration::from_secs(1))
                        .map_err(|_| "timed out draining command stderr".to_string())?
                        .map_err(|error| format!("failed to read stderr: {error}"))?;
                    return Ok(Output {
                        status,
                        stdout,
                        stderr,
                    });
                }
                Ok(None) if Instant::now() >= deadline => {
                    Self::terminate_command_group(&mut child);
                    let _ = child.wait();
                    return Err(format!(
                        "command {:?} timed out after {} ms",
                        command.get_program(),
                        timeout.as_millis()
                    ));
                }
                Ok(None) => thread::sleep(Duration::from_millis(10)),
                Err(error) => {
                    Self::terminate_command_group(&mut child);
                    let _ = child.wait();
                    return Err(format!("failed to check command status: {error}"));
                }
            }
        }
    }

    fn terminate_command_group(child: &mut std::process::Child) {
        #[cfg(unix)]
        unsafe {
            // Each command is placed in a process group whose id is the direct child pid.
            // A negative pid targets every descendant still in that group.
            let _ = libc::kill(-(child.id() as i32), libc::SIGKILL);
        }
        let _ = child.kill();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::fs;
    use std::os::unix::fs::symlink;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    struct TestDir(PathBuf);

    impl TestDir {
        fn new(label: &str) -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "workstation-monitor-{label}-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn repository_symlinks_are_detected_without_recursive_symlink_traversal() {
        let root = TestDir::new("git-discovery-root");
        let outside = TestDir::new("git-discovery-outside");
        let outside_repo = outside.path().join("external-repo");
        fs::create_dir_all(outside_repo.join(".git")).unwrap();
        let direct_repo_link = root.path().join("external-repo-link");
        symlink(&outside_repo, &direct_repo_link).unwrap();
        let indirect_root = outside.path().join("indirect-root");
        fs::create_dir_all(indirect_root.join("nested-repo/.git")).unwrap();
        symlink(&indirect_root, root.path().join("indirect-link")).unwrap();

        let mut repositories = Vec::new();
        GitRadar::find_git_repos(root.path(), 0, 2, &mut repositories);

        assert_eq!(repositories, vec![direct_repo_link]);
    }

    #[test]
    fn nested_search_roots_are_visited_only_once() {
        let home = TestDir::new("git-overlapping-roots");
        let workspace = home.path().join("workspace");
        let repository = workspace.join("project");
        fs::create_dir_all(repository.join(".git")).unwrap();
        let mut repositories = Vec::new();
        let mut visited = HashSet::new();

        GitRadar::find_git_repos_once(&workspace, 0, 2, &mut visited, &mut repositories);
        GitRadar::find_git_repos_once(home.path(), 0, 2, &mut visited, &mut repositories);

        assert_eq!(repositories, vec![repository]);
    }

    #[test]
    fn git_commands_are_terminated_after_the_deadline() {
        let started = Instant::now();
        let result = GitRadar::run_command_with_timeout(
            Command::new("/bin/sleep").arg("1"),
            Duration::from_millis(30),
        );

        assert!(result.is_err());
        assert!(started.elapsed() < Duration::from_millis(500));
    }

    #[cfg(unix)]
    #[test]
    fn git_command_timeout_cannot_be_extended_by_a_child_holding_output_pipes() {
        let started = Instant::now();
        let result = GitRadar::run_command_with_timeout(
            Command::new("/bin/sh").args(["-c", "sleep 2 &"]),
            Duration::from_millis(40),
        );

        assert!(result.is_ok());
        assert!(started.elapsed() < Duration::from_millis(700));
    }

    #[test]
    fn repositories_are_inspected_with_bounded_parallelism() {
        let repositories = (0..8)
            .map(|index| PathBuf::from(format!("/tmp/repository-{index}")))
            .collect::<Vec<_>>();
        let active = AtomicUsize::new(0);
        let peak = AtomicUsize::new(0);

        GitRadar::inspect_repositories_with(&repositories, 4, |_| {
            let current = active.fetch_add(1, Ordering::SeqCst) + 1;
            peak.fetch_max(current, Ordering::SeqCst);
            std::thread::sleep(Duration::from_millis(20));
            active.fetch_sub(1, Ordering::SeqCst);
            None
        });

        assert!(peak.load(Ordering::SeqCst) > 1);
        assert!(peak.load(Ordering::SeqCst) <= 4);
    }

    #[test]
    fn failed_git_status_is_reported_as_unknown_instead_of_clean() {
        let (is_dirty, count, status_error) =
            GitRadar::summarize_git_status(Err("git status timed out".to_string()));

        assert!(!is_dirty);
        assert_eq!(count, 0);
        assert_eq!(status_error.as_deref(), Some("git status timed out"));
    }
}
